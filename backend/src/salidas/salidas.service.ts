import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Vehiculo } from '../flota/vehiculo.entity';
import { Viaje } from '../chofer/entities/viaje.entity';
import { Pasaje } from '../pasajes/pasaje.entity';
import { Usuario } from '../auth/usuario.entity';
import { ROLES } from '../auth/roles';
import { NotificacionChofer } from '../chofer/entities/notificacion.entity';
import { NotificacionPasajero } from '../notificaciones/notificacion-pasajero.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { FlotaGateway } from '../flota/flota.gateway';
import { NotificacionSecretaria } from './notificacion-secretaria.entity';
import { NotificacionesSecretariaGateway } from './notificaciones-secretaria.gateway';
import {
  obtenerAsientosDistribuidos,
  normalizarConfiguracionAsientos,
} from '../flota/asientos-config.util';
import {
  reindexarFilaOficial,
  ESTADOS_EXCLUIDOS_DE_FILA,
} from '../flota/fila.util';

// Duración de la cuenta regresiva: 10 minutos reales, persistidos como
// salidaProgramada = ahora + 10 min.
const DURACION_SALIDA_MS = 10 * 60 * 1000;

const NOMBRES_PARADAS: Record<string, string> = {
  cochabamba: 'Cochabamba',
  eterazama: 'Eterazama',
};

export interface ResultadoSalida {
  aplicada: boolean;
  motivo?: string;
  vehiculo?: Vehiculo;
  notificaciones: NotificacionPasajero[];
  notificacionesChofer: NotificacionChofer[];
  notificacionesSecretaria: NotificacionSecretaria[];
}

@Injectable()
export class SalidasService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  // Guard de solapamiento: el temporizador y las lecturas nunca ejecutan dos
  // pasadas de transiciones al mismo tiempo.
  private procesandoSalidas = false;

  constructor(
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,

    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,

    @InjectRepository(NotificacionSecretaria)
    private readonly notifSecretariaRepo: Repository<NotificacionSecretaria>,

    private readonly dataSource: DataSource,

    private readonly flotaGateway: FlotaGateway,

    private readonly notificacionesService: NotificacionesService,

    private readonly secretariaGateway: NotificacionesSecretariaGateway,
  ) {}

  // =============================================================
  // 0. TEMPORIZADOR DEL BACKEND (O9)
  // El responsable de pasar de POR SALIR a EN RUTA es el backend, NO un
  // setTimeout de React. Cada 15 segundos revisa los vehículos cuyo
  // salidaProgramada ya venció y los transita de forma transaccional.
  // =============================================================

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.procesarSalidasPendientes();
    }, 15_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // Procesa los vehículos "por salir" cuyo salidaProgramada ya pasó.
  // Es el temporizador real. También se invoca desde las lecturas principales
  // (fila del chofer y boletería de secretaría) para que la transición ocurra
  // de inmediato al hacer GET, sin depender solo del intervalo.
  async procesarSalidasPendientes(): Promise<void> {
    if (this.procesandoSalidas) return;
    this.procesandoSalidas = true;
    try {
      const candidatos = await this.vehiculoRepo.find({
        where: { estadoViaje: 'por_salir' },
      });

      for (const v of candidatos) {
        const salida = v.salidaProgramada
          ? new Date(v.salidaProgramada).getTime()
          : 0;
        if (!salida || salida > Date.now()) continue;

        let resultado: ResultadoSalida | null = null;
        try {
          resultado = await this.dataSource.transaction(async (manager) => {
            const vehiculoRepo = manager.getRepository(Vehiculo);

            // Serie por parada para no colisionar con anotarse/salir/ventas.
            const lockKey =
              v.paradaActual === 'cochabamba'
                ? 771001
                : v.paradaActual === 'eterazama'
                ? 771002
                : 771100;
            await manager.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

            const vehiculoLock = await vehiculoRepo.findOne({
              where: { id: v.id },
              lock: { mode: 'pessimistic_write' },
            });

            // Re-chequeo bajo el lock: si otra ejecución ya lo transitó
            // (chofer pulsó EN RUTA manualmente), no se hace nada y evitamos
            // la doble ejecución.
            if (!vehiculoLock || vehiculoLock.estadoViaje !== 'por_salir') {
              return null;
            }
            const s = vehiculoLock.salidaProgramada
              ? new Date(vehiculoLock.salidaProgramada).getTime()
              : 0;
            if (!s || s > Date.now()) return null;

            return this.transicionarEnRutaEnTransaccion(manager, vehiculoLock);
          });
        } catch {
          // Si una transacción individual falla se sigue con la siguiente.
        }

        if (resultado) {
          this.flotaGateway.notificarCambioFlota();
          this.emitirNotificaciones(resultado);
        }
      }
    } finally {
      this.procesandoSalidas = false;
    }
  }

  // =============================================================
  // 1. PROGRAMAR SALIDA (MANUAL, O4)
  // Solo el chofer del puesto 1 de su parada puede programar la salida de su
  // vehículo. Asigna salidaProgramada = ahora + 10 min (timestamp persistido)
  // y pasa el vehículo a "por salir". Es idempotente: si ya está por_salir no
  // sobrescribe (sin doble activación).
  // =============================================================

  async programarSalida(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const placa = usuario.placaAsignada;

    const resultado = await this.dataSource.transaction(async (manager) => {
      const vehiculoRepo = manager.getRepository(Vehiculo);

      let vehiculoRef = await vehiculoRepo.findOne({ where: { placa } });
      if (!vehiculoRef) {
        throw new NotFoundException('Vehiculo no encontrado');
      }

      if (
        vehiculoRef.paradaActual !== 'cochabamba' &&
        vehiculoRef.paradaActual !== 'eterazama'
      ) {
        throw new BadRequestException(
          'Debes estar anotado en una fila para programar la salida.',
        );
      }

      const lockKey =
        vehiculoRef.paradaActual === 'cochabamba' ? 771001 : 771002;
      await manager.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

      const vehiculo = await vehiculoRepo.findOne({
        where: { placa },
        lock: { mode: 'pessimistic_write' },
      });

      if (!vehiculo) {
        throw new NotFoundException('Vehiculo no encontrado');
      }

      if (vehiculo.estadoViaje === 'mantenimiento') {
        throw new BadRequestException(
          'El vehículo está en mantenimiento y no puede programar salida.',
        );
      }
      if (vehiculo.estadoViaje === 'en_ruta') {
        throw new BadRequestException(
          'El vehículo ya está EN RUTA y no puede programar otra salida.',
        );
      }
      // Sin doble activación: si ya está programado, no se sobrescribe.
      if (vehiculo.estadoViaje === 'por_salir') {
        return {
          aplicada: false,
          motivo: 'ya_programada',
          vehiculo,
          mensaje: 'Tu vehículo ya está en POR SALIR.',
          notificaciones: [],
          notificacionesChofer: [],
          notificacionesSecretaria: [],
        };
      }

      // Solo el chofer del PUESTO 1 puede programar la salida (el que parte).
      if (vehiculo.puestoFila !== 1) {
        throw new BadRequestException(
          `Solo el chofer del PUESTO 1 puede programar la salida. Tu vehículo (${placa}) ocupa el puesto ${vehiculo.puestoFila}.`,
        );
      }

      return this.programarSalidaEnTransaccion(manager, vehiculo.id, {
        manual: true,
      });
    });

    if (!resultado.aplicada) {
      return {
        estadoViaje: resultado.vehiculo?.estadoViaje || 'listo',
        salidaProgramada: resultado.vehiculo?.salidaProgramada || null,
        mensaje:
          (resultado as { mensaje?: string }).mensaje ||
          'Salida ya programada.',
      };
    }

    this.flotaGateway.notificarCambioFlota();
    this.emitirNotificaciones(resultado);

    return {
      estadoViaje: 'por_salir',
      salidaProgramada: resultado.vehiculo?.salidaProgramada || null,
      mensaje: 'Salida programada: el vehículo partirá en 10 minutos.',
    };
  }

  // =============================================================
  // 2. PROGRAMAR SALIDA DENTRO DE UNA TRANSACCIÓN EXISTENTE (O3/O4)
  // Reutilizada por:
  //   - programarSalida (manual)
  //   - la última venta que llena el vehículo en registrarVenta, venderBoleteria
  //     y ventaManual (auto programación en la MISMA transacción de la venta).
  // Si el vehículo no tiene configuración de asientos, NO se auto-programa
  // (comportamiento B1 "configuración pendiente"); el chofer igualmente puede
  // programar manualmente.
  // =============================================================

  async programarSalidaEnTransaccion(
    manager: EntityManager,
    vehiculoId: number,
    opciones: { manual?: boolean } = {},
  ): Promise<ResultadoSalida> {
    const vehiculoRepo = manager.getRepository(Vehiculo);
    const usuarioRepo = manager.getRepository(Usuario);

    const vehiculo = await vehiculoRepo.findOne({
      where: { id: vehiculoId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    // Idempotencia: si ya está por_salir (o en ruta/mantenimiento) no se
    // sobrescribe la programación.
    if (
      vehiculo.estadoViaje === 'por_salir' ||
      vehiculo.estadoViaje === 'en_ruta' ||
      vehiculo.estadoViaje === 'mantenimiento'
    ) {
      return {
        aplicada: false,
        motivo: 'no_disponible',
        notificaciones: [],
        notificacionesChofer: [],
        notificacionesSecretaria: [],
      };
    }

    if (
      vehiculo.paradaActual !== 'cochabamba' &&
      vehiculo.paradaActual !== 'eterazama'
    ) {
      throw new BadRequestException(
        'El vehículo no está anotado en ninguna fila y no puede programar salida.',
      );
    }

    const manual = opciones.manual === true;

    if (!manual) {
      // Auto programación por vehículo LLENO: solo con configuración real de
      // asientos (sin fallback [1,2]). Sin configuración => B1 pendiente.
      if (!vehiculo.configuracionAsientos || !vehiculo.configuracionAsientos?.filas?.length) {
        return {
          aplicada: false,
          motivo: 'configuracion_pendiente',
          notificaciones: [],
          notificacionesChofer: [],
          notificacionesSecretaria: [],
        };
      }
      const chofer = new Set(vehiculo.asientosChofer || []);
      const config = normalizarConfiguracionAsientos(
        vehiculo.configuracionAsientos,
        vehiculo.capacidadTotal,
      );
      const vendibles = obtenerAsientosDistribuidos(config).length;
      const pasajerosVendibles = Math.max(vendibles - chofer.size, 0);
      const ocupadosPasajeros = (vehiculo.asientosOcupados || []).filter(
        (a) => !chofer.has(a),
      ).length;

      if (pasajerosVendibles <= 0 || ocupadosPasajeros < pasajerosVendibles) {
        return {
          aplicada: false,
          motivo: 'no_lleno',
          notificaciones: [],
          notificacionesChofer: [],
          notificacionesSecretaria: [],
        };
      }
    } else {
      // Manual: solo el puesto 1 puede (validado también en programarSalida).
      if (vehiculo.puestoFila !== 1) {
        throw new BadRequestException(
          `Solo el chofer del PUESTO 1 puede programar la salida. Este vehículo ocupa el puesto ${vehiculo.puestoFila}.`,
        );
      }
    }

    const parada = vehiculo.paradaActual;

    // Al pasar a "por salir" el vehículo deja de ocupar un puesto numerado:
    // se muestra aparte con su cuenta regresiva. El siguiente de la fila sube
    // al puesto 1 y puede vender hasta la partida.
    vehiculo.estadoViaje = 'por_salir';
    vehiculo.salidaProgramada = new Date(Date.now() + DURACION_SALIDA_MS);
    vehiculo.puestoFila = 0;
    vehiculo.fechaEstado = new Date();
    await vehiculoRepo.save(vehiculo);

    const placasOficiales = await this.placasOficialesActivas();
    await reindexarFilaOficial(vehiculoRepo, parada, placasOficiales);

    // Notificaciones a los 3 roles, dentro de la MISMA transacción.
    const notifPasajeros = await this.crearNotificacionesSalida(
      manager,
      vehiculo,
      parada,
    );

    const nombreParada = NOMBRES_PARADAS[parada] || parada;

    const notifChofer = await this.crearNotificacionChofer(
      manager,
      vehiculo,
      'salida_programada',
      'Salida programada',
      `Tu vehículo ${vehiculo.placa} saldrá en 10 minutos desde ${nombreParada}.`,
      usuarioRepo,
    );

    const notifSecretaria = await this.crearNotificacionesSecretaria(
      manager,
      'salida_programada',
      'Salida programada',
      `El vehículo ${vehiculo.placa} saldrá en 10 minutos desde ${nombreParada}.`,
    );

    return {
      aplicada: true,
      vehiculo,
      notificaciones: notifPasajeros,
      notificacionesChofer: notifChofer,
      notificacionesSecretaria: notifSecretaria,
    };
  }

  // =============================================================
  // 3. TRANSICIÓN POR SALIR -> EN RUTA (O10)
  // Se ejecuta dentro de una transacción YA abierta por el llamador con el
  // vehículo bloqueado (pessimistic_write) y re-validado: nunca se duplica.
  // =============================================================

  async transicionarEnRutaEnTransaccion(
    manager: EntityManager,
    vehiculo: Vehiculo,
  ): Promise<ResultadoSalida> {
    const vehiculoRepo = manager.getRepository(Vehiculo);
    const viajeRepo = manager.getRepository(Viaje);
    const usuarioRepo = manager.getRepository(Usuario);

    const paradaOrigen = vehiculo.paradaActual;

    vehiculo.estadoViaje = 'en_ruta';
    vehiculo.estadoVehiculo = 'activo';
    vehiculo.paradaActual = 'fuera_de_fila';
    vehiculo.puestoFila = 0;
    vehiculo.horaIngresoFila = null;
    vehiculo.salidaProgramada = null;
    vehiculo.fechaEstado = new Date();
    await vehiculoRepo.save(vehiculo);

    // Marcar el viaje abierto como EN RUTA con su hora de salida.
    const viaje = await viajeRepo.findOne({
      where: { placaVehiculo: vehiculo.placa },
      order: { fechaCreacion: 'DESC' },
    });
    if (viaje && viaje.estado === 'programado') {
      viaje.estado = 'en_ruta';
      viaje.horaSalida =
        viaje.horaSalida || new Date().toTimeString().slice(0, 5);
      await viajeRepo.save(viaje);
    }

    // Reindexar la fila de la que salió el vehículo.
    if (paradaOrigen === 'cochabamba' || paradaOrigen === 'eterazama') {
      const placasOficiales = await this.placasOficialesActivas();
      await reindexarFilaOficial(vehiculoRepo, paradaOrigen, placasOficiales);
    }

    const notifPasajeros = await this.crearNotificacionesSalida(
      manager,
      vehiculo,
      paradaOrigen,
    );

    const nombreParada = NOMBRES_PARADAS[paradaOrigen] || paradaOrigen;

    const notifChofer = await this.crearNotificacionChofer(
      manager,
      vehiculo,
      'salida_en_ruta',
      'Salida en ruta',
      `Tu vehículo ${vehiculo.placa} quedó EN RUTA partiendo desde ${nombreParada}.`,
      usuarioRepo,
    );

    const notifSecretaria = await this.crearNotificacionesSecretaria(
      manager,
      'salida_en_ruta',
      'Salida en ruta',
      `El vehículo ${vehiculo.placa} partió EN RUTA desde ${nombreParada}.`,
    );

    return {
      aplicada: true,
      vehiculo,
      notificaciones: notifPasajeros,
      notificacionesChofer: notifChofer,
      notificacionesSecretaria: notifSecretaria,
    };
  }

  // =============================================================
  // 4. NOTIFICACIONES (O6/O7/O8)
  // =============================================================

  // Notificaciones para los pasajeros AUTÉNTICOS del viaje de ese vehículo:
  // solo pasajes con pasajeroUsuarioId vinculado (jamás se inventan cuentas)
  // y aún activos (no reembolsados ni utilizados).
  private async crearNotificacionesSalida(
    manager: EntityManager,
    vehiculo: Vehiculo,
    paradaOrigen: string,
  ): Promise<NotificacionPasajero[]> {
    const pasajeRepo = manager.getRepository(Pasaje);
    const notifRepo = manager.getRepository(NotificacionPasajero);

    const pasajes = await pasajeRepo.find({
      where: { placaVehiculo: vehiculo.placa },
    });

    const nombreParada =
      NOMBRES_PARADAS[paradaOrigen] || paradaOrigen;

    const creadas: NotificacionPasajero[] = [];
    const porPlaca = vehiculo.estadoViaje === 'por_salir';

    for (const p of pasajes) {
      if (!p.pasajeroUsuarioId) continue;
      if (p.estadoReembolso === 'REEMBOLSADO') continue;
      if (p.estadoBoleto === 'UTILIZADO') continue;

      const titulo = porPlaca ? 'Salida programada' : 'Salida en ruta';
      const mensaje = porPlaca
        ? `El vehículo ${vehiculo.placa} saldrá en 10 minutos desde ${nombreParada}. Aborda a tiempo.`
        : `El vehículo ${vehiculo.placa} partió EN RUTA desde ${nombreParada}. Buen viaje.`;

      const notificacion = notifRepo.create({
        usuarioId: p.pasajeroUsuarioId,
        tipo: porPlaca ? 'salida_programada' : 'salida_en_ruta',
        titulo,
        mensaje,
      });
      creadas.push(await notifRepo.save(notificacion));
    }

    return creadas;
  }

  private async crearNotificacionChofer(
    manager: EntityManager,
    vehiculo: Vehiculo,
    tipo: string,
    titulo: string,
    mensaje: string,
    usuarioRepo: Repository<Usuario>,
  ): Promise<NotificacionChofer[]> {
    const notifRepo = manager.getRepository(NotificacionChofer);

    const chofer = await usuarioRepo.find({
      where: { rol: ROLES.CHOFER, placaAsignada: vehiculo.placa },
    });

    const creadas: NotificacionChofer[] = [];
    for (const c of chofer) {
      const notificacion = notifRepo.create({
        choferId: c.id,
        tipo,
        titulo,
        mensaje,
      });
      creadas.push(await notifRepo.save(notificacion));
    }
    return creadas;
  }

  private async crearNotificacionesSecretaria(
    manager: EntityManager,
    tipo: string,
    titulo: string,
    mensaje: string,
  ): Promise<NotificacionSecretaria[]> {
    const usuarioRepo = manager.getRepository(Usuario);
    const notifRepo = manager.getRepository(NotificacionSecretaria);

    const secretarias = await usuarioRepo.find({
      where: { rol: ROLES.SECRETARIA, estado: 'activo' },
    });

    const creadas: NotificacionSecretaria[] = [];
    for (const s of secretarias) {
      const notificacion = notifRepo.create({
        secretariaId: s.id,
        tipo,
        titulo,
        mensaje,
      });
      creadas.push(await notifRepo.save(notificacion));
    }
    return creadas;
  }

  // Emisión WebSocket DESPUÉS del commit (best-effort). Los datos ya están en
  // PostgreSQL; si el WS falla se consultan por GET.
  emitirNotificaciones(resultado: ResultadoSalida) {
    for (const n of resultado.notificaciones) {
      this.notificacionesService.notificarWS(n.usuarioId, n);
    }
    for (const n of resultado.notificacionesSecretaria) {
      this.secretariaGateway.emitir(n.secretariaId, n);
    }
  }

  // =============================================================
  // 5. NOTIFICACIONES DE SECRETARÍA (gestión + aislamiento, O8)
  // =============================================================

  async obtenerNotificacionesSecretaria(secretariaId: string) {
    return this.notifSecretariaRepo.find({
      where: { secretariaId },
      order: { fechaCreacion: 'DESC' },
    });
  }

  async marcarSecretariaNotificacionLeida(
    secretariaId: string,
    notificacionId: string,
  ) {
    const notificacion = await this.notifSecretariaRepo.findOne({
      where: { id: notificacionId, secretariaId },
    });

    // Aislamiento: si la notificación no es de esta secretaria => 404.
    if (!notificacion) {
      throw new NotFoundException('Notificación no encontrada');
    }

    notificacion.leida = true;
    return this.notifSecretariaRepo.save(notificacion);
  }

  async marcarTodasSecretariaLeidas(secretariaId: string) {
    await this.notifSecretariaRepo.update(
      { secretariaId, leida: false },
      { leida: true },
    );
    return { success: true };
  }

  private async placasOficialesActivas(): Promise<Set<string>> {
    const choferes = await this.usuarioRepo.find({
      where: { rol: ROLES.CHOFER, estado: 'activo' },
      select: { placaAsignada: true },
    });
    return new Set(
      choferes
        .map((c) => c.placaAsignada)
        .filter((p): p is string => !!p),
    );
  }
}