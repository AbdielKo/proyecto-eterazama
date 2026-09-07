import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Between, EntityManager } from 'typeorm';

import { Vehiculo } from '../flota/vehiculo.entity';
import { SolicitudRetiro } from '../flota/solicitud-retiro.entity';
import { Viaje } from './entities/viaje.entity';
import { Boleto } from './entities/boleto.entity';
import { NotificacionChofer } from './entities/notificacion.entity';
import { Liquidacion } from './entities/liquidacion.entity';
import { Pasaje } from '../pasajes/pasaje.entity';
import { Review } from '../reviews/review.entity';
import { Usuario } from '../auth/usuario.entity';
import { FlotaGateway } from '../flota/flota.gateway';
import { normalizarConfiguracionAsientos, obtenerAsientosDistribuidos } from '../flota/asientos-config.util';
import { ROLES } from '../auth/roles';
import { SalidasService } from '../salidas/salidas.service';
import { SecretariaService } from '../secretaria/secretaria.service';
import { PdfService } from '../pasajes/pdf.service';
import { VentaManualChoferDto } from './dto/venta-manual-chofer.dto';
import { ActorAuditoria } from '../auditoria/auditoria.service';
import {
  reindexarFilaOficial,
  obtenerSiguientePuesto,
  calcularPuestosFila,
} from '../flota/fila.util';

const NOMBRES_PARADAS: Record<string, string> = {
  cochabamba: 'Cochabamba',
  eterazama: 'Eterazama',
};

@Injectable()
export class ChoferService {

  constructor(
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,

    private readonly dataSource: DataSource,

    private readonly flotaGateway: FlotaGateway,

    @InjectRepository(Viaje)
    private readonly viajeRepo: Repository<Viaje>,

    @InjectRepository(Boleto)
    private readonly boletoRepo: Repository<Boleto>,

    @InjectRepository(NotificacionChofer)
    private readonly notificacionRepo: Repository<NotificacionChofer>,

    @InjectRepository(Liquidacion)
    private readonly liquidacionRepo: Repository<Liquidacion>,

    @InjectRepository(Pasaje)
    private readonly pasajeRepo: Repository<Pasaje>,

    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,

    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,

    @InjectRepository(SolicitudRetiro)
    private readonly solicitudRetiroRepo: Repository<SolicitudRetiro>,

    private readonly salidasService: SalidasService,

    private readonly secretariaService: SecretariaService,

    private readonly pdfService: PdfService,
  ) {}


  // =============================================
  // 1. INICIO - Dashboard del chofer
  // =============================================

  async obtenerInicio(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const placa = usuario.placaAsignada;
    if (!placa) {
      return {
        nombre: usuario.nombre || usuario.nombreUsuario,
        estadoServicio: usuario.estado,
        vehiculo: null,
        placa: null,
        paradaActual: null,
        puestoFila: null,
        estadoVehiculo: null,
        estadoViaje: null,
        pasajerosCount: 0,
        asientosOcupados: 0,
        asientosDisponibles: 0,
        calificacionPromedio: 0,
      };
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa },
    });

    const pasajes = await this.pasajeRepo.find({
      where: { placaVehiculo: placa },
    });

    const reviews = await this.reviewRepo.find({
      where: { vehiculoId: vehiculo?.id || 0 },
    });

    const asientosChofer = this.obtenerAsientosChofer(vehiculo);
    const ocupados = vehiculo?.asientosOcupados?.length || 0;
    const capacidad = vehiculo?.capacidadTotal || 12;
    const config = normalizarConfiguracionAsientos(
      vehiculo?.configuracionAsientos,
      capacidad,
    );
    const configuracionPendiente = asientosChofer.length === 0 || !vehiculo?.configuracionAsientos;
    const vendibles = obtenerAsientosDistribuidos(config).length;

    const promedio = reviews.length > 0
      ? Number((reviews.reduce((acc, r) => acc + r.estrellas, 0) / reviews.length).toFixed(2))
      : 0;

    // FUENTE ÚNICA: pasajeros actuales = solo si el vehículo está operativo
    // (en fila puesto 1 o en ruta). NO se usa pasajes.length (histórico).
    const pasajerosCount = this.pasajerosActualesChofer(vehiculo, ocupados);

    return {
      nombre: usuario.nombre || usuario.nombreUsuario,
      estadoServicio: usuario.estado,
      vehiculo: vehiculo ? `${vehiculo.tipoVehiculo} ${vehiculo.color}` : null,
      placa,
      paradaActual: vehiculo?.paradaActual || null,
      puestoFila: vehiculo?.puestoFila || null,
      estadoVehiculo: vehiculo?.estadoVehiculo || 'inactivo',
      estadoViaje: vehiculo?.estadoViaje || 'listo',
      asientosChofer,
      configuracionPendiente,
      pasajerosCount,
      asientosOcupados: pasajerosCount,
      asientosDisponibles: Math.max(0, vendibles - asientosChofer.length - pasajerosCount),
      calificacionPromedio: promedio,
    };
  }

  private obtenerAsientosChofer(vehiculo: Vehiculo | null): number[] {
    return vehiculo?.asientosChofer || [];
  }

  // FUENTE ÚNICA DE VERDAD para "pasajeros actuales" del chofer.
  // Un vehículo tiene pasajeros actuales SOLO si:
  //   - Está en fila como puesto 1 (recibiendo ventas), O
  //   - Está EN RUTA
  // En cualquier otro caso: 0 pasajeros actuales.
  // NO borra historial, NO modifica boletos/pasajes/viajes.
  private pasajerosActualesChofer(vehiculo: Vehiculo | null, ocupados: number): number {
    if (!vehiculo) return 0;
    if (vehiculo.estadoVehiculo === 'inactivo') return 0;
    if (vehiculo.estadoViaje === 'mantenimiento') return 0;
    if (vehiculo.paradaActual === 'fuera_de_fila' && vehiculo.estadoViaje !== 'en_ruta') return 0;
    if (
      (vehiculo.paradaActual === 'cochabamba' || vehiculo.paradaActual === 'eterazama') &&
      vehiculo.puestoFila !== 1
    ) return 0;
    if (vehiculo.estadoViaje === 'por_salir') return 0;
    return ocupados;
  }

  // =============================================
  // 1.1 CAMBIAR ESTADO DE SERVICIO DEL CHOFER
  // El chofer activa/desactiva SU PROPIO estado (autenticado por JWT).
  //   - Activar: requiere rol=chofer, no estar bloqueado y tener un
  //     vehículo asignado y existente en la flota.
  //   - Desactivar: bloqueado si hay operación activa (en fila, en ruta,
  //     pasajeros a bordo, viaje activo, solicitud de retiro pendiente).
  // =============================================

  async cambiarEstadoServicio(choferId: string, estado: string) {
    if (estado !== 'activo' && estado !== 'inactivo') {
      throw new BadRequestException(
        'Estado inválido. Debe ser "activo" o "inactivo".',
      );
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (usuario.rol !== ROLES.CHOFER) {
      throw new BadRequestException(
        'Solo un chofer puede cambiar su estado de servicio.',
      );
    }

    const destino = estado === 'activo' ? 'activo' : 'inactivo';

    if (destino === 'activo') {
      if (usuario.estado === 'bloqueado') {
        throw new BadRequestException(
          'Tu cuenta está bloqueada. No puedes activar tu estado de servicio.',
        );
      }
      if (!usuario.placaAsignada) {
        throw new BadRequestException(
          'No tienes un vehículo asignado. La secretaría debe asignarte uno antes de que puedas activar tu estado.',
        );
      }
      const vehiculo = await this.vehiculoRepo.findOne({
        where: { placa: usuario.placaAsignada },
      });
      if (!vehiculo) {
        throw new BadRequestException(
          'El vehículo asignado no existe en la flota. Contacta a la secretaría.',
        );
      }
    } else {
      // DESACTIVAR: el chofer pasa a INACTIVO. Reglas de negocio:
      //   - No puede estar EN RUTA ni en MANTENIMIENTO.
      //   - Si ocupa el puesto 1 de la fila y ya tiene pasajeros/asientos
      //     vendidos a bordo, NO se destruye la venta: se bloquea para que
      //     finalice/use la opción de retiro y la secretaría transfiera.
      //   - Si está ANOTADO en una fila pero SIN pasajeros vendidos, se le
      //     permite desactivar y el sistema lo saca automáticamente de la
      //     fila (puesto 0) y lo lleva a FUERA DE FILA.
      const vehiculo = usuario.placaAsignada
        ? await this.vehiculoRepo.findOne({
            where: { placa: usuario.placaAsignada },
          })
        : null;
      if (vehiculo) {
        const asientosChoferSet = new Set(vehiculo.asientosChofer || []);
        const pasajerosVendidos = (vehiculo.asientosOcupados || []).filter(
          (a) => !asientosChoferSet.has(a),
        ).length;

        if (vehiculo.estadoViaje === 'en_ruta') {
          throw new BadRequestException(
            'No puedes desactivar tu estado mientras te encuentres EN RUTA. Finaliza el recorrido primero.',
          );
        }
        if (vehiculo.estadoViaje === 'mantenimiento') {
          throw new BadRequestException(
            'No puedes desactivar tu estado mientras estés en mantenimiento.',
          );
        }
        // Protección de ventas: puesto 1 con pasajeros vendidos en la fila.
        if (
          (vehiculo.paradaActual === 'cochabamba' ||
            vehiculo.paradaActual === 'eterazama') &&
          vehiculo.puestoFila === 1 &&
          pasajerosVendidos > 0
        ) {
          throw new BadRequestException(
            'No puedes desactivar tu estado porque eres el puesto 1 y ya tienes pasajeros/asientos vendidos. Finaliza la ruta o usa la opción "Solicitar retiro de la fila" para que la secretaría transfiera tus pasajeros.',
          );
        }
      }
      const viajeActivo = usuario.placaAsignada
        ? await this.viajeRepo.findOne({
            where: {
              placaVehiculo: usuario.placaAsignada,
              estado: 'en_ruta',
            },
          })
        : null;
      if (viajeActivo) {
        throw new BadRequestException(
          'No puedes desactivar tu estado mientras tengas un viaje activo. Finaliza el viaje primero.',
        );
      }
      const retiroPendiente = await this.solicitudRetiroRepo.findOne({
        where: { choferId, estado: 'PENDIENTE' },
      });
      if (retiroPendiente) {
        throw new BadRequestException(
          'No puedes desactivar tu estado mientras tengas una solicitud de retiro pendiente de aprobación.',
        );
      }
    }

    usuario.estado = destino;
    const guardado = await this.usuarioRepo.save(usuario);

    // Sincronizar el estado del VEHÍCULO con la única fuente de verdad del
    // estado de servicio del chofer (usuario.estado) para que Inicio, Mi Fila,
    // Secretaría y Boletería siempre vean el MISMO estado.
    if (usuario.placaAsignada) {
      const vehiculo = await this.vehiculoRepo.findOne({
        where: { placa: usuario.placaAsignada },
      });
      if (vehiculo) {
        if (destino === 'inactivo') {
          // Fuera de servicio: sin fila, sin puesto, sin ubicación y sin
          // asientos de pasajeros activos. El historial queda intacto.
          await this.sacarDeFila(vehiculo);
          vehiculo.paradaActual = 'fuera_de_fila';
          vehiculo.puestoFila = 0;
          vehiculo.horaIngresoFila = null;
          vehiculo.estadoViaje = 'listo';
          vehiculo.estadoVehiculo = 'inactivo';
          vehiculo.asientosOcupados = this.asientosFinalizados(vehiculo);
          vehiculo.fechaEstado = new Date();
          await this.vehiculoRepo.save(vehiculo);
        } else {
          // Reactivar: el vehículo vuelve a ACTIVO y queda listo, pero NO se
          // anota automáticamente en ninguna fila (entrada voluntaria).
          vehiculo.estadoVehiculo = 'activo';
          if (vehiculo.estadoViaje === 'mantenimiento' || vehiculo.estadoViaje === 'fin_de_ruta') {
            vehiculo.estadoViaje = 'listo';
          }
          vehiculo.fechaEstado = new Date();
          await this.vehiculoRepo.save(vehiculo);
        }
        this.flotaGateway.notificarCambioFlota();
      }
    }

    return {
      id: guardado.id,
      estado: guardado.estado,
      mensaje:
        destino === 'activo'
          ? 'Estado de servicio activado correctamente.'
          : 'Estado de servicio desactivado correctamente.',
    };
  }

  // Calcula los asientos que deben quedar OCUPADOS después de finalizar un
  // viaje: únicamente los asientos del chofer configurados (asientosChofer),
  // sin inventar ningún fallback como [1,2]. Si el vehículo no tiene
  // configuración de chofer, el resultado es [].
  private asientosFinalizados(vehiculo: Vehiculo | null): number[] {
    if (!vehiculo) return [];
    return Array.from(
      new Set((vehiculo.asientosChofer || []).map(Number)),
    ).filter((n) => Number.isInteger(n) && n >= 1).sort((a, b) => a - b);
  }


  // =============================================
  // 2. MI VEHICULO
  // =============================================

  async obtenerMiVehiculo(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    const capacidad = Math.max(4, vehiculo.capacidadTotal || 12);
    const asientosChofer = this.obtenerAsientosChofer(vehiculo);
    const ocupadosRaw = (vehiculo.asientosOcupados || []).filter(
      (a) => a >= 1 && a <= capacidad && !asientosChofer.includes(a),
    ).length;

    // FUENTE ÚNICA: pasajeros actuales solo si el vehículo está operativo
    const ocupadosTotal = this.pasajerosActualesChofer(vehiculo, ocupadosRaw);

    // Informacion real de pasajeros por asiento (misma fuente que Secretaria:
    // la tabla pasajes de PostgreSQL). Sin datos privados innecesarios.
    const pasajes = await this.pasajeRepo.find({
      where: { placaVehiculo: vehiculo.placa },
    });

    const pasajerosPorAsiento: Record<number, {
      pasajeroNombre: string;
      estadoPasaje: string;
    }> = {};

    pasajes.forEach((p) => {
      const asientos = p.asientos || [];
      const estadoPasaje =
        p.estadoReembolso === 'REEMBOLSADO'
          ? 'reembolsado'
          : p.estadoReembolso === 'PENDIENTE'
            ? 'pendiente de reembolso'
            : 'comprado';

      asientos.forEach((num) => {
        if (!pasajerosPorAsiento[num]) {
          pasajerosPorAsiento[num] = {
            pasajeroNombre: p.pasajeroNombre || '',
            estadoPasaje,
          };
        }
      });

      // Si el pasaje trae la lista detallada de pasajeros por asiento, usarla
      if (Array.isArray(p.pasajeros)) {
        p.pasajeros.forEach((pj: { asiento?: number; nombre?: string }) => {
          if (pj?.asiento != null) {
            pasajerosPorAsiento[pj.asiento] = {
              pasajeroNombre: pj.nombre || p.pasajeroNombre || '',
              estadoPasaje,
            };
          }
        });
      }
    });

    const mapaAsientos: {
      numero: number;
      estado: string;
      pasajero: string | null;
      estadoPasaje: string | null;
    }[] = [];

    for (let i = 1; i <= capacidad; i++) {
      // Los asientos reservados para el chofer (configurables por la secretaría)
      if (asientosChofer.includes(i)) {
        mapaAsientos.push({ numero: i, estado: 'chofer', pasajero: null, estadoPasaje: null });
        continue;
      }
      const ocupado = (vehiculo.asientosOcupados || []).includes(i);
      if (ocupado) {
        const info = pasajerosPorAsiento[i];
        mapaAsientos.push({
          numero: i,
          estado: 'ocupado',
          pasajero: info?.pasajeroNombre || null,
          estadoPasaje: info?.estadoPasaje || null,
        });
      } else {
        mapaAsientos.push({ numero: i, estado: 'disponible', pasajero: null, estadoPasaje: null });
      }
    }

    return {
      id: vehiculo.id,
      placa: vehiculo.placa,
      tipoVehiculo: vehiculo.tipoVehiculo,
      choferNombre: vehiculo.choferNombre,
      choferCi: vehiculo.choferCi,
      color: vehiculo.color,
      capacidadTotal: capacidad,
      estadoVehiculo: vehiculo.estadoVehiculo,
      estadoViaje: vehiculo.estadoViaje,
      qrImagenUrl: vehiculo.qrImagenUrl,
      paradaActual: vehiculo.paradaActual,
      puestoFila: vehiculo.puestoFila,
      horaIngresoFila: vehiculo.horaIngresoFila,
      fechaEstado: vehiculo.fechaEstado,
      asientosOcupados: vehiculo.asientosOcupados,
      asientosChofer,
      configuracionPendiente: asientosChofer.length === 0 || !vehiculo.configuracionAsientos,
      configuracionAsientos: normalizarConfiguracionAsientos(
        vehiculo.configuracionAsientos,
        capacidad,
      ),
      ocupadosTotal: ocupadosTotal,
      asientosLibres: Math.max(
        0,
        obtenerAsientosDistribuidos(
          normalizarConfiguracionAsientos(vehiculo.configuracionAsientos, capacidad),
        ).length - asientosChofer.length - ocupadosTotal,
      ),
      mapaAsientos,
    };
  }


  // =============================================
  // 3. MI FILA
  // =============================================

  async obtenerMiFila(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    // Lazy-check: si la cuenta regresiva de un "por salir" ya venció, el backend
    // lo transiciona a EN RUTA aquí mismo (además del temporizador de 15 s),
    // para que esta respuesta sea consistente de inmediato.
    await this.salidasService.procesarSalidasPendientes();

    const todosVehiculos = await this.vehiculoRepo.find({
      order: { puestoFila: 'ASC' },
    });

    // La fila solo contiene choferes OFICIALES (usuario con rol=chofer y
    // vehículo asignado) y ACTIVOS. Los vehículos sin chofer oficial asociado
    // (huérfanos) y los de choferes INACTIVOS no se muestran en la fila.
    const choferesOficiales = await this.usuarioRepo.find({
      where: { rol: ROLES.CHOFER, estado: 'activo' },
      select: { placaAsignada: true },
    });
    const placasOficiales = new Set(
      choferesOficiales
        .map((c) => c.placaAsignada)
        .filter((p): p is string => !!p),
    );
    const vehiculosOficiales = todosVehiculos.filter((v) =>
      placasOficiales.has(v.placa),
    );

    // Posición REAL y ACTUAL calculada con el MISMO criterio oficial que
    // reindexa PostgreSQL (fuente de verdad): solo choferes oficiales activos,
    // sin por_salir/en_ruta/mantenimiento. Nunca se expone un valor histórico.
    // Un vehículo único en su parada SIEMPRE ocupa el puesto 1 aunque su
    // puestoFila persistido haya quedado desplazado.
    const puestosReales = new Map<string, number>();
    for (const parada of ['cochabamba', 'eterazama']) {
      for (const [placa, puesto] of calcularPuestosFila(
        todosVehiculos,
        parada,
        placasOficiales,
      )) {
        puestosReales.set(placa, puesto);
      }
    }

    const resumir = (lista: Vehiculo[]) => lista.map(v => {
      const choferSet = new Set(v.asientosChofer || []);
      const ocupadosRaw = (v.asientosOcupados || []).filter((a) => !choferSet.has(a)).length;
      // FUENTE ÚNICA: pasajeros actuales solo si el vehículo está operativo
      const pasajeros = this.pasajerosActualesChofer(v, ocupadosRaw);
      return {
        placa: v.placa,
        tipoVehiculo: v.tipoVehiculo,
        color: v.color,
        puestoFila: puestosReales.get(v.placa) ?? v.puestoFila,
        choferNombre: v.choferNombre,
        choferCi: v.choferCi,
        estado: v.estadoVehiculo,
        estadoViaje: v.estadoViaje,
        salidaProgramada: v.salidaProgramada,
        horaIngresoFila: v.horaIngresoFila,
        pasajeros,
      };
    });

    // Vehículos que NO ocupan puesto numerado en la fila: los no anotados
    // (puestoFila = 0, solo ubicados en el sector) y los por_salir/en_ruta/
    // mantenimiento (se muestran en sus propias secciones).
    const noOcupaPuesto = (v: Vehiculo) =>
      (v.puestoFila || 0) <= 0 ||
      v.estadoViaje === 'por_salir' ||
      v.estadoViaje === 'en_ruta' ||
      v.paradaActual === 'en_ruta' ||
      v.estadoViaje === 'mantenimiento';

    const cochabamba = resumir(vehiculosOficiales.filter(v => v.paradaActual === 'cochabamba' && !noOcupaPuesto(v)));
    const eterazama = resumir(vehiculosOficiales.filter(v => v.paradaActual === 'eterazama' && !noOcupaPuesto(v)));
    const porSalir = resumir(vehiculosOficiales.filter(v => v.estadoViaje === 'por_salir'));
    const enRuta = resumir(vehiculosOficiales.filter(v => v.estadoViaje === 'en_ruta' || v.paradaActual === 'en_ruta'));
    const fueraDeFila = resumir(vehiculosOficiales.filter(v => v.paradaActual === 'fuera_de_fila' && v.estadoViaje !== 'en_ruta'));

    // ANOTADO en una fila: ubicado en un sector Y ocupando un puesto numerado.
    const anotadoEnFila =
      (vehiculo.paradaActual === 'cochabamba' || vehiculo.paradaActual === 'eterazama') &&
      (vehiculo.puestoFila || 0) > 0;
    const miLista = anotadoEnFila
      ? vehiculo.paradaActual === 'cochabamba'
        ? cochabamba
        : eterazama
      : [];
    const miPosicion = anotadoEnFila
      ? miLista.findIndex((v) => v.placa === vehiculo.placa)
      : -1;

    return {
      ubicacion: vehiculo.paradaActual,
      paradaActual: vehiculo.paradaActual,
      yaRegistrado: anotadoEnFila,
      miPuesto: miPosicion >= 0 ? miPosicion + 1 : 0,
      posicionEnFila: miPosicion >= 0 ? miPosicion + 1 : 0,
      totalEnFila: miLista.length,
      estadoVehiculo: vehiculo.estadoVehiculo,
      estadoViaje: vehiculo.estadoViaje,
      salidaProgramada: vehiculo.salidaProgramada,
      cochabamba,
      eterazama,
      porSalir,
      enRuta,
      fueraDeFila,
      delante: miPosicion > 0 ? miLista.slice(0, miPosicion) : [],
      detras: miPosicion >= 0 ? miLista.slice(miPosicion + 1) : [],
    };
  }

  async anotarseEnFila(choferId: string, parada: string) {
    const paradas = ['cochabamba', 'eterazama'];
    if (!paradas.includes(parada)) {
      throw new BadRequestException('Parada no valida. Debe ser cochabamba o eterazama');
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    // Regla de choferes activos: un chofer INACTIVO no puede anotarse en la
    // fila. Debe activar su estado de servicio desde su panel primero.
    if (usuario.estado !== 'activo') {
      if (usuario.estado === 'bloqueado') {
        throw new BadRequestException(
          'Tu cuenta está bloqueada. No puedes anotarte en la fila.',
        );
      }
      throw new BadRequestException(
        'No puedes ingresar a la fila porque tu estado de servicio está INACTIVO. Activa tu estado desde tu panel para poder anotarte en la fila.',
      );
    }

    const placa = usuario.placaAsignada;
    const nombreParada = parada === 'cochabamba' ? 'Cochabamba' : 'Eterazama';

    // Placas de los choferes oficiales: solo esos ocupan puestos numerados.
    const placasOficiales = await this.obtenerPlacasOficiales();

    // Operación atómica y serializada: se toma un lock transaccional de
    // PostgreSQL por parada para que dos "Anotarme en la fila" simultáneos NO
    // puedan obtener el mismo puesto. Validación, asignación de puesto,
    // reindexado y creación del viaje ocurren en la MISMA transacción.
    const resultado = await this.dataSource.transaction(async (manager) => {
      const vehiculoRepo = manager.getRepository(Vehiculo);

      const lockKey = parada === 'cochabamba' ? 771001 : 771002;
      await manager.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

      const vehiculo = await vehiculoRepo.findOne({
        where: { placa },
        lock: { mode: 'pessimistic_write' },
      });

      if (!vehiculo) {
        throw new NotFoundException('Vehiculo no encontrado');
      }

      // Un vehículo POR SALIR ya está comprometido con su partida: no puede
      // anotarse en otra fila (apenas deja su parada actual, quedará EN RUTA).
      if (vehiculo.estadoViaje === 'por_salir') {
        throw new BadRequestException(
          'El vehiculo está POR SALIR y no puede anotarse en otra fila.',
        );
      }

      if (vehiculo.estadoVehiculo !== 'activo') {
        throw new BadRequestException('El vehiculo se encuentra inactivo y no puede anotarse en la fila');
      }

      if (vehiculo.estadoViaje === 'mantenimiento') {
        throw new BadRequestException('El vehiculo se encuentra en mantenimiento y no puede anotarse en la fila');
      }

      if (vehiculo.estadoViaje === 'en_ruta') {
        throw new BadRequestException('El vehiculo se encuentra EN RUTA y no puede anotarse en la fila hasta que termine el recorrido');
      }

      // La anotación en la fila es VOLUNTARIA y solo puede hacerse si el
      // chofer está ubicado (paradaActual) en el MISMO sector en el que desea
      // anotarse. "Estar en la parada" no equivale a "estar anotado en la fila":
      // primero se selecciona la ubicación y luego se anota explícitamente.
      if (vehiculo.paradaActual !== parada) {
        const miSector =
          vehiculo.paradaActual === 'cochabamba'
            ? 'Cochabamba'
            : vehiculo.paradaActual === 'eterazama'
            ? 'Eterazama'
            : 'fuera de fila';
        throw new BadRequestException(
          `No puedes anotarte en la fila de ${nombreParada} porque tu ubicación actual es ${miSector}. Selecciona tu ubicación en ${nombreParada} y luego anótate.`,
        );
      }

      // Ya anotado en la misma fila (ocupa un puesto numerado).
      if ((vehiculo.puestoFila || 0) > 0) {
        throw new BadRequestException(
          `Ya estas anotado en la fila de ${nombreParada} en el puesto #${vehiculo.puestoFila}.`,
        );
      }

      // El nuevo puesto es el siguiente de los vehículos oficiales que ocupan
      // puesto (los "por salir" y en ruta NO ocupan puesto y no cuentan).
      const nuevoPuesto = await obtenerSiguientePuesto(
        vehiculoRepo,
        parada,
        placasOficiales,
      );

      // La ubicación (paradaActual) ya quedó fijada al sector; la anotación
      // solo asigna el puesto numerado dentro de la fila de ese sector.
      vehiculo.puestoFila = nuevoPuesto;
      vehiculo.estadoViaje = 'listo';
      vehiculo.estadoVehiculo = 'activo';
      vehiculo.horaIngresoFila = new Date();
      // Nuevo ciclo de operación: los asientos de PASAJEROS quedan disponibles
      // para el nuevo viaje. Se conservan los asientos del chofer (sin fallback).
      // El historial de boletos/pasajes/viajes anteriores NO se modifica.
      vehiculo.asientosOcupados = this.asientosFinalizados(vehiculo);
      await vehiculoRepo.save(vehiculo);

      await this.reindexarFila(parada, manager, placasOficiales);
      await this.iniciarNuevoViaje(vehiculo, parada, manager);

      return {
        paradaActual: vehiculo.paradaActual,
        puestoFila: nuevoPuesto,
        horaIngresoFila: vehiculo.horaIngresoFila,
      };
    });

    this.flotaGateway.notificarCambioFlota();

    return {
      ...resultado,
      mensaje: `Te anotaste en la fila de ${nombreParada}, puesto #${resultado.puestoFila}`,
    };
  }

  // Al anotarse en la fila se inicia un nuevo viaje con los asientos de
  // pasajeros nuevamente disponibles (los 2 asientos del chofer se reservan).
  // No se elimina ni modifica el historial de viajes/pasajes anteriores.
  private async iniciarNuevoViaje(vehiculo: Vehiculo, parada: string, manager?: EntityManager) {
    const viajeRepo = manager ? manager.getRepository(Viaje) : this.viajeRepo;
    const viajeAbierto = await viajeRepo.findOne({
      where: { placaVehiculo: vehiculo.placa },
      order: { fechaCreacion: 'DESC' },
    });

    if (viajeAbierto && (viajeAbierto.estado === 'programado' || viajeAbierto.estado === 'en_ruta')) {
      return;
    }

    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    const hora = hoy.toTimeString().slice(0, 8);

    const origen = NOMBRES_PARADAS[parada] || 'Cochabamba';
    const destino = parada === 'cochabamba'
      ? NOMBRES_PARADAS['eterazama']
      : NOMBRES_PARADAS['cochabamba'];

    const nuevoViaje = viajeRepo.create({
      placaVehiculo: vehiculo.placa,
      choferNombre: vehiculo.choferNombre,
      origen,
      destino,
      fecha: `${anio}-${mes}-${dia}`,
      horaSalida: hora,
      estado: 'programado',
      asientosOcupados: 0,
      capacidadTotal: vehiculo.capacidadTotal,
      totalGenerado: 0,
      pasajerosTransportados: 0,
    });

    await viajeRepo.save(nuevoViaje);
  }

  async salirDeFila(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const placa = usuario.placaAsignada;

    const resultado = await this.dataSource.transaction(async (manager) => {
      const vehiculoRepo = manager.getRepository(Vehiculo);
      const pasajeRepo = manager.getRepository(Pasaje);

      // Leer la parada actual para tomar el lock transaccional de la fila y
      // serializar la salida con una anotación simultánea.
      let vehiculoRef = await vehiculoRepo.findOne({ where: { placa } });
      if (!vehiculoRef) {
        throw new NotFoundException('Vehiculo no encontrado');
      }
      const paradaRef = vehiculoRef.paradaActual;
      if (paradaRef === 'cochabamba' || paradaRef === 'eterazama') {
        const lockKey = paradaRef === 'cochabamba' ? 771001 : 771002;
        await manager.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
      }

      const vehiculo = await vehiculoRepo.findOne({
        where: { placa },
        lock: { mode: 'pessimistic_write' },
      });

      if (!vehiculo) {
        throw new NotFoundException('Vehiculo no encontrado');
      }

      if (vehiculo.paradaActual !== 'cochabamba' && vehiculo.paradaActual !== 'eterazama') {
        throw new BadRequestException('No estas registrado en ninguna fila');
      }

      // Si el chofer ocupa el puesto 1 y ya tiene pasajeros/asientos vendidos,
      // no puede retirarse directamente: debe solicitarlo y esperar la
      // transferencia de pasajeros por parte de la secretaría.
      if (vehiculo.puestoFila === 1) {
        const pasajes = await pasajeRepo.find({
          where: { placaVehiculo: placa },
        });
        const activos = pasajes.filter(
          (p) =>
            p.estadoBoleto === 'ACTIVO' &&
            p.estadoReembolso !== 'REEMBOLSADO' &&
            !p.fechaEscaneo,
        );

        if (activos.length > 0 || (vehiculo.asientosOcupados || []).length > 0) {
          throw new BadRequestException(
            'No puedes retirarte directamente porque eres el puesto 1 y ya tienes pasajeros/asientos vendidos. Usa la opción "Solicitar retiro de la fila" para que la secretaría transfiera tus pasajeros.',
          );
        }
      }

      const paradaSalida = vehiculo.paradaActual;

      // Salir de la fila: el chofer deja de ocupar un puesto, pero CONSERVA su
      // ubicación/sector (para el chofer, "estar en la parada" es distinto de
      // "estar anotado en la fila"). Queda situado en su sector con puesto 0.
      vehiculo.puestoFila = 0;
      vehiculo.horaIngresoFila = null;
      vehiculo.estadoViaje = 'listo';
      // Al salir de fila: limpiar asientos de pasajeros. Los pasajes/viajes
      // anteriores quedan en el historial de PostgreSQL sin borrar.
      vehiculo.asientosOcupados = this.asientosFinalizados(vehiculo);
      await vehiculoRepo.save(vehiculo);

      await this.reindexarFila(paradaSalida, manager);

      return { paradaActual: vehiculo.paradaActual };
    });

    this.flotaGateway.notificarCambioFlota();

    return {
      paradaActual: resultado.paradaActual,
      mensaje: 'Saliste de la fila correctamente. Los puestos se reorganizaron.',
    };
  }

  // =============================================
  // 3.2 CAMBIAR UBICACIÓN / SECTOR DEL CHOFER
  // =============================================
  // El chofer indica manualmente en qué sector se encuentra (COCHABAMBA o
  // ETERAZAMA). La ubicación es independiente de la fila: seleccionar un
  // sector NO anota al chofer en la fila. Si el chofer estaba anotado en una
  // fila de otro sector, se le saca automáticamente de esa fila (puesto 0,
  // reindex) para evitar inconsistencias antes de cambiar de sector.
  async cambiarUbicacion(choferId: string, ubicacion: string) {
    const ubicaciones = ['cochabamba', 'eterazama'];
    if (!ubicaciones.includes(ubicacion)) {
      throw new BadRequestException(
        'Ubicación no válida. Debe ser cochabamba o eterazama.',
      );
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });
    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }
    if (usuario.estado !== 'activo') {
      throw new BadRequestException(
        'Tu estado de servicio está INACTIVO. Activa tu estado antes de indicar tu ubicación.',
      );
    }

    const placa = usuario.placaAsignada;
    const nombreUbicacion = ubicacion === 'cochabamba' ? 'Cochabamba' : 'Eterazama';

    const resultado = await this.dataSource.transaction(async (manager) => {
      const vehiculoRepo = manager.getRepository(Vehiculo);

      const vehiculo = await vehiculoRepo.findOne({
        where: { placa },
        lock: { mode: 'pessimistic_write' },
      });
      if (!vehiculo) {
        throw new NotFoundException('Vehiculo no encontrado');
      }

      if (vehiculo.estadoViaje === 'en_ruta') {
        throw new BadRequestException(
          'No puedes cambiar tu ubicación mientras estés EN RUTA. Finaliza el recorrido primero.',
        );
      }

      // Si está anotado en una fila de OTRO sector (o del mismo), al cambiar
      // de ubicación sale de esa fila automáticamente (puesto 0 + reindex),
      // para que nunca quede "ubicación = X" y "fila = Y" a la vez.
      const anotadoEn =
        (vehiculo.puestoFila || 0) > 0 &&
        (vehiculo.paradaActual === 'cochabamba' ||
          vehiculo.paradaActual === 'eterazama')
          ? vehiculo.paradaActual
          : null;
      if (anotadoEn && anotadoEn !== ubicacion) {
        const paradaAnterior = anotadoEn;
        vehiculo.puestoFila = 0;
        vehiculo.horaIngresoFila = null;
        vehiculo.estadoViaje = 'listo';
        vehiculo.asientosOcupados = this.asientosFinalizados(vehiculo);
        await vehiculoRepo.save(vehiculo);
        await this.reindexarFila(paradaAnterior, manager);
      }

      vehiculo.paradaActual = ubicacion;
      vehiculo.fechaEstado = new Date();
      // Cambiar de sector NO anota en la fila: queda situado con puesto 0.
      vehiculo.puestoFila = 0;
      vehiculo.horaIngresoFila = null;
      vehiculo.estadoViaje = 'listo';
      await vehiculoRepo.save(vehiculo);

      return { paradaActual: vehiculo.paradaActual, puestoFila: vehiculo.puestoFila };
    });

    this.flotaGateway.notificarCambioFlota();

    return {
      ...resultado,
      mensaje: `Tu ubicación actual se guardó correctamente en ${nombreUbicacion}. Para entrar a la fila, presiona "Anotarme en ${nombreUbicacion}".`,
    };
  }

  private async reindexarFila(parada: string, manager?: EntityManager, placasOficiales?: Set<string>) {
    const repo = manager ? manager.getRepository(Vehiculo) : this.vehiculoRepo;
    const placas = placasOficiales ?? await this.obtenerPlacasOficiales();
    await reindexarFilaOficial(repo, parada, placas);
  }

  // Placas de los choferes oficiales (rol=chofer, estado activo, con vehículo
  // asignado). Es el criterio ÚNICO de quién ocupa un puesto numerado.
  private async obtenerPlacasOficiales(): Promise<Set<string>> {
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


  // =============================================
  // 3.1 RETIRO VOLUNTARIO DE LA FILA
  // =============================================
  //
  // El chofer solicita retirarse de la fila. Si es el puesto 1 y ya tiene
  // pasajeros/asientos vendidos, la solicitud queda PENDIENTE y la secretaría
  // transfiere los pasajeros al siguiente chofer (puesto 2) antes de aprobar.
  // Si no tiene pasajeros, se aprueba automáticamente (retiro directo).

  async solicitarRetiroFila(choferId: string, motivo: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    if (!motivo || !motivo.trim()) {
      throw new BadRequestException('Debe indicar el motivo del retiro.');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    if (vehiculo.paradaActual !== 'cochabamba' && vehiculo.paradaActual !== 'eterazama') {
      throw new BadRequestException('No estas registrado en ninguna fila para solicitar un retiro.');
    }

    // No permitir dos solicitudes pendientes simultáneas
    const pendiente = await this.solicitudRetiroRepo.findOne({
      where: { choferId, estado: 'PENDIENTE' },
    });
    if (pendiente) {
      throw new BadRequestException(
        'Ya tienes una solicitud de retiro pendiente de aprobación por la secretaría.',
      );
    }

    const puestoFila = vehiculo.puestoFila || 0;
    const tienePasajeros =
      (vehiculo.asientosOcupados || []).length > 0;

    const solicitud = this.solicitudRetiroRepo.create({
      choferId,
      choferNombre: `${usuario.nombre || ''} ${usuario.apellidos || ''}`.trim() || usuario.nombreUsuario,
      placa: vehiculo.placa,
      vehiculoId: vehiculo.id,
      parada: vehiculo.paradaActual,
      puestoFila,
      tienePasajeros,
      cantidadAsientos: vehiculo.asientosOcupados?.length || 0,
      motivo: motivo.trim(),
      estado: 'PENDIENTE',
    });

    const guardada = await this.solicitudRetiroRepo.save(solicitud);
    this.flotaGateway.notificarCambioFlota();

    const mensaje = puestoFila === 1 && tienePasajeros
      ? 'Solicitud enviada. Como eres el puesto 1 con pasajeros, la secretaría transferirá tus pasajeros al siguiente chofer antes de aprobarla.'
      : 'Solicitud enviada a la secretaría para su aprobación.';

    return {
      solicitud: guardada,
      aprobacionAutomatica: !(puestoFila === 1 && tienePasajeros),
      mensaje,
    };
  }

  async obtenerMiSolicitudRetiro(choferId: string) {
    const solicitud = await this.solicitudRetiroRepo.findOne({
      where: { choferId },
      order: { fechaCreacion: 'DESC' },
    });
    return solicitud || null;
  }


  // =============================================
  // 4. MI VIAJE
  // =============================================

  async obtenerMiViaje(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const viaje = await this.viajeRepo.findOne({
      where: {
        placaVehiculo: usuario.placaAsignada,
        estado: Between('programado', 'en_ruta') as any,
      },
      order: { fechaCreacion: 'DESC' },
    });

    if (!viaje) {
      const ultimoViaje = await this.viajeRepo.findOne({
        where: { placaVehiculo: usuario.placaAsignada },
        order: { fechaCreacion: 'DESC' },
      });
      return ultimoViaje || null;
    }

    const boletos = await this.boletoRepo.find({
      where: { viajeId: viaje.id },
    });

    return {
      ...viaje,
      pasajerosRegistrados: boletos.length,
      asientosOcupados: boletos.length,
      asientosDisponibles: viaje.capacidadTotal - boletos.length,
    };
  }

  // Placa del chofer autenticado (JWT): base de todas las validaciones de
  // propiedad sobre viajes y boletos.
  private async obtenerUsuarioAsignado(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    return usuario;
  }

  async iniciarViaje(choferId: string, viajeId: string) {
    const usuario = await this.obtenerUsuarioAsignado(choferId);

    const viaje = await this.viajeRepo.findOne({
      where: { id: viajeId },
    });

    if (!viaje) {
      throw new NotFoundException('Viaje no encontrado');
    }

    // Regla de propiedad: solo el chofer del MISMO vehículo puede gestionar
    // este viaje.
    if (viaje.placaVehiculo !== usuario.placaAsignada) {
      throw new BadRequestException(
        `Este viaje corresponde al vehículo ${viaje.placaVehiculo}, no al suyo (${usuario.placaAsignada}).`,
      );
    }

    viaje.estado = 'en_ruta';
    viaje.horaSalida = new Date().toTimeString().slice(0, 5);
    await this.viajeRepo.save(viaje);

    await this.crearNotificacion(choferId, 'viaje', 'Viaje iniciado', 'Su viaje ha comenzado. Estado: En ruta.');

    return viaje;
  }

  async finalizarViaje(choferId: string, viajeId: string) {
    const usuario = await this.obtenerUsuarioAsignado(choferId);

    const viaje = await this.viajeRepo.findOne({
      where: { id: viajeId },
    });

    if (!viaje) {
      throw new NotFoundException('Viaje no encontrado');
    }

    // Regla de propiedad: solo el chofer del MISMO vehículo puede finalizar
    // este viaje.
    if (viaje.placaVehiculo !== usuario.placaAsignada) {
      throw new BadRequestException(
        `Este viaje corresponde al vehículo ${viaje.placaVehiculo}, no al suyo (${usuario.placaAsignada}).`,
      );
    }

    // Operación atómica: se bloquea el vehículo PRIMERO (pessimistic_write),
    // al igual que registrarVenta() y ventaManual(), y dentro de la MISMA
    // transacción se relee el estado real y se actualizan el viaje y el
    // vehículo. Los asientos de PASAJEROS se liberan, pero los asientos del
    // chofer (asientosChofer) se conservan tal como están configurados, sin
    // inventar ningún fallback [1,2]. Si una venta coincide de forma
    // simultánea, PostgreSQL serializa ambas sobre la misma fila del vehículo.
    const viajeFinalizado =
      await this.dataSource.transaction(async (manager) => {
        const vehiculoRepo = manager.getRepository(Vehiculo);
        const viajeRepo = manager.getRepository(Viaje);
        const boletoRepo = manager.getRepository(Boleto);

        const vehiculo = await vehiculoRepo.findOne({
          where: { placa: viaje.placaVehiculo },
          lock: { mode: 'pessimistic_write' },
        });

        if (!vehiculo) {
          throw new NotFoundException('Vehiculo no encontrado');
        }

        // Releer el viaje bajo el mismo lock (conserva los datos reales)
        const viajeActual = await viajeRepo.findOne({
          where: { id: viaje.id },
        });

        if (!viajeActual) {
          throw new NotFoundException('Viaje no encontrado');
        }

        viajeActual.estado = 'finalizado';
        viajeActual.horaLlegada = new Date().toTimeString().slice(0, 5);
        await viajeRepo.save(viajeActual);

        const boletos = await boletoRepo.find({
          where: { viajeId: viajeActual.id },
        });

        viajeActual.pasajerosTransportados = boletos.length;
        viajeActual.totalGenerado = boletos.reduce((acc, b) => acc + Number(b.monto), 0);
        await viajeRepo.save(viajeActual);

        // Liberar los asientos de pasajeros para la siguiente salida. Los
        // asientos del chofer (asientosChofer) se conservan sin tocar.
        const paradaOrigen = vehiculo.paradaActual;

        vehiculo.asientosOcupados = this.asientosFinalizados(vehiculo);
        vehiculo.estadoViaje = 'fin_de_ruta';
        vehiculo.estadoVehiculo = 'activo';
        // Al finalizar el viaje el vehículo NO vuelve a la fila: ACTIVO y
        // FUERA DE FILA (puesto 0). El chofer se anota voluntariamente.
        vehiculo.paradaActual = 'fuera_de_fila';
        vehiculo.puestoFila = 0;
        vehiculo.horaIngresoFila = null;
        await vehiculoRepo.save(vehiculo);

        if (paradaOrigen === 'cochabamba' || paradaOrigen === 'eterazama') {
          await this.reindexarFila(paradaOrigen, manager);
        }

        return viajeActual;
      });

    // Se notifica SOLO después de que la transacción hizo commit.
    this.flotaGateway.notificarCambioFlota();
    await this.crearNotificacion(choferId, 'viaje', 'Viaje finalizado', `Viaje finalizado. ${viajeFinalizado.pasajerosTransportados} pasajeros transportados.`);

    return viajeFinalizado;
  }


  // =============================================
  // 5. MIS PASAJEROS
  // =============================================

  async obtenerMisPasajeros(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const viaje = await this.viajeRepo.findOne({
      where: { placaVehiculo: usuario.placaAsignada },
      order: { fechaCreacion: 'DESC' },
    });

    if (!viaje) {
      return [];
    }

    const boletos = await this.boletoRepo.find({
      where: { viajeId: viaje.id },
      order: { asiento: 'ASC' },
    });

    return boletos.map(b => ({
      id: b.id,
      pasajeroNombre: b.pasajeroNombre,
      asiento: b.asiento,
      destino: b.destino,
      estadoBoleto: b.estadoBoleto,
      estadoPago: b.estadoPago,
      escaneado: b.escaneado,
    }));
  }

  async confirmarAbordaje(choferId: string, boletoId: string) {
    const usuario = await this.obtenerUsuarioAsignado(choferId);

    const boleto = await this.boletoRepo.findOne({
      where: { id: boletoId },
    });

    if (!boleto) {
      throw new NotFoundException('Boleto no encontrado');
    }

    // Regla de propiedad: solo el chofer del MISMO vehículo puede gestionar
    // el boleto.
    if (boleto.placaVehiculo !== usuario.placaAsignada) {
      throw new BadRequestException(
        `Este boleto corresponde al vehículo ${boleto.placaVehiculo}, no al suyo (${usuario.placaAsignada}).`,
      );
    }

    boleto.estadoBoleto = 'abordado';
    boleto.escaneado = true;
    await this.boletoRepo.save(boleto);

    return boleto;
  }

  async marcarNoPresentado(choferId: string, boletoId: string) {
    const usuario = await this.obtenerUsuarioAsignado(choferId);

    const boleto = await this.boletoRepo.findOne({
      where: { id: boletoId },
    });

    if (!boleto) {
      throw new NotFoundException('Boleto no encontrado');
    }

    // Regla de propiedad: solo el chofer del MISMO vehículo puede gestionar
    // el boleto.
    if (boleto.placaVehiculo !== usuario.placaAsignada) {
      throw new BadRequestException(
        `Este boleto corresponde al vehículo ${boleto.placaVehiculo}, no al suyo (${usuario.placaAsignada}).`,
      );
    }

    boleto.estadoBoleto = 'no_presentado';
    await this.boletoRepo.save(boleto);

    return boleto;
  }


  // =============================================
  // 6. CONTROL DE ASIENTOS
  // =============================================

  async obtenerMapaAsientos(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    const viaje = await this.viajeRepo.findOne({
      where: { placaVehiculo: usuario.placaAsignada },
      order: { fechaCreacion: 'DESC' },
    });

    const boletos = viaje
      ? await this.boletoRepo.find({ where: { viajeId: viaje.id } })
      : [];

    const asientos: { numero: number; estado: string; pasajero: string | null; destino: string | null }[] = [];
    for (let i = 1; i <= vehiculo.capacidadTotal; i++) {
      const boleto = boletos.find(b => b.asiento === i);
      let estado = 'disponible';
      if (boleto) {
        if (boleto.estadoBoleto === 'abordado') estado = 'abordado';
        else if (boleto.estadoPago === 'pagado') estado = 'pagado';
        else estado = 'reservado';
      }

      asientos.push({
        numero: i,
        estado,
        pasajero: boleto?.pasajeroNombre || null,
        destino: boleto?.destino || null,
      });
    }

    return {
      placa: vehiculo.placa,
      capacidadTotal: vehiculo.capacidadTotal,
      asientos,
      disponibles: asientos.filter(a => a.estado === 'disponible').length,
      reservados: asientos.filter(a => a.estado === 'reservado').length,
      pagados: asientos.filter(a => a.estado === 'pagado').length,
      abordados: asientos.filter(a => a.estado === 'abordado').length,
    };
  }

  // Pantalla de venta manual del chofer: reutiliza el mapa de asientos del
  // vehículo del chofer (JWT) y suma los precios oficiales vigentes (mismo
  // origen que el núcleo de venta). También devuelve la fila/puesto REAL con la
  // MISMA fuente oficial del proyecto (calcularPuestosFila) y el sentido de
  // venta permitido (derivado de la parada actual), de modo que el frontend
  // solo muestra datos y el backend decide el sentido en la venta.
  async obtenerDatosVentaManual(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario) {
      throw new NotFoundException('Chofer no encontrado.');
    }

    const vehiculo = usuario.placaAsignada
      ? await this.vehiculoRepo.findOne({
          where: { placa: usuario.placaAsignada },
        })
      : null;

    const mapa = vehiculo
      ? await this.obtenerMapaAsientos(choferId)
      : null;

    // Puesto REAL con la fuente oficial compartida (la misma de obtenerMiFila
    // y reindexarFilaOficial). Nunca se expone un valor histórico.
    let puestoReal = vehiculo ? vehiculo.puestoFila || 0 : 0;
    if (vehiculo && vehiculo.paradaActual) {
      const todos = await this.vehiculoRepo.find({
        order: { puestoFila: 'ASC' },
      });
      const oficiales = await this.usuarioRepo.find({
        where: { rol: ROLES.CHOFER, estado: 'activo' },
        select: { placaAsignada: true },
      });
      const placas = new Set(
        oficiales
          .map((c) => c.placaAsignada)
          .filter((p): p is string => !!p),
      );
      puestoReal =
        calcularPuestosFila(todos, vehiculo.paradaActual, placas).get(
          vehiculo.placa,
        ) ?? 0;
    }

    const parada = vehiculo ? vehiculo.paradaActual : null;
    const esParadaValida = parada === 'cochabamba' || parada === 'eterazama';
    const sentido =
      parada === 'cochabamba'
        ? { tramo: 'cochabamba', origen: 'Cochabamba', destino: 'Eterazama' }
        : parada === 'eterazama'
          ? { tramo: 'eterazama', origen: 'Eterazama', destino: 'Cochabamba' }
          : null;

    const motivos = this.validarReglasVentaChofer(
      usuario,
      vehiculo,
      puestoReal,
    );

    return {
      chofer: {
        id: usuario.id,
        nombreUsuario: usuario.nombreUsuario,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        estado: usuario.estado,
        placaAsignada: usuario.placaAsignada,
      },
      vehiculo: vehiculo
        ? {
            id: vehiculo.id,
            placa: vehiculo.placa,
            tipoVehiculo: vehiculo.tipoVehiculo,
            color: vehiculo.color,
            capacidadTotal: Math.max(4, vehiculo.capacidadTotal || 12),
            estadoVehiculo: vehiculo.estadoVehiculo,
            estadoViaje: vehiculo.estadoViaje,
            paradaActual: vehiculo.paradaActual,
            puestoFila: puestoReal,
            asientosOcupados: vehiculo.asientosOcupados || [],
            asientosChofer: vehiculo.asientosChofer || [],
            configuracionAsientos: normalizarConfiguracionAsientos(
              vehiculo.configuracionAsientos,
              Math.max(4, vehiculo.capacidadTotal || 12),
            ),
            mapa: mapa?.asientos || [],
          }
        : null,
      precios: await this.secretariaService.obtenerPreciosVenta(),
      sentido,
      permiteVenta: motivos.length === 0 && esParadaValida,
      motivos,
    };
  }

  // Motivos (en texto) que impiden la venta manual en este momento. Si se
  // devuelve una lista vacía, el chofer puede vender. Estas son las MISMAS
  // reglas que revalida el backend dentro de la transacción de venta: se
  // muestran al chofer ANTES de la venta y no se confía en ellas.
  private validarReglasVentaChofer(
    usuario: Usuario,
    vehiculo: Vehiculo | null,
    puestoReal: number,
  ) {
    const motivos: string[] = [];

    if (!usuario || !vehiculo) {
      motivos.push('No tienes un vehículo asignado.');
      return motivos;
    }

    if (usuario.estado !== 'activo') {
      motivos.push(
        'No puedes vender boletos porque tu estado de servicio está INACTIVO.',
      );
    }

    if (
      vehiculo.estadoVehiculo === 'inactivo' ||
      vehiculo.estadoViaje === 'mantenimiento'
    ) {
      motivos.push(
        `Tu vehículo está fuera de servicio (${vehiculo.estadoVehiculo === 'inactivo' ? 'inactivo' : 'mantenimiento'}); no puede vender pasajes.`,
      );
    }

    if (vehiculo.estadoViaje === 'por_salir') {
      motivos.push('Tu vehículo está POR SALIR y ya no recibe ventas.');
    }

    if (
      vehiculo.paradaActual !== 'cochabamba' &&
      vehiculo.paradaActual !== 'eterazama'
    ) {
      motivos.push(
        'No puedes vender boletos porque no estás anotado en ninguna fila.',
      );
    } else if (!(puestoReal > 0)) {
      motivos.push(
        'No puedes vender boletos porque no estás anotado en ninguna fila.',
      );
    } else if (puestoReal !== 1) {
      motivos.push(
        `No puedes vender boletos porque actualmente ocupas el puesto #${puestoReal} de la fila. Solo el primero de la fila puede vender.`,
      );
    }

    return motivos;
  }

  // Venta manual del chofer: delega en el MISMO núcleo de venta que la
  // boletería de secretaría (precios, fila, asientos, ocupados, salida) y
  // registra la auditoría con la identidad del chofer (JWT). El frontend jamás
  // envía precios, vehículo ni método de pago.
  async ventaManualChofer(
    choferId: string,
    dto: VentaManualChoferDto,
    actor: ActorAuditoria,
  ) {
    return this.secretariaService.ventaManualChofer(dto, actor, choferId);
  }

  // Genera el recibo PDF de un pasaje vendido por ESTE chofer (solo permite
  // descargar pasajes de su propio vehículo según el JWT). Reutiliza el mismo
  // generador de comprobantes en PDF del sistema.
  async obtenerReciboPdf(choferId: string, pasajeId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });
    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tienes un vehículo asignado.');
    }

    const pasaje = await this.pasajeRepo.findOne({
      where: { id: pasajeId },
    });

    if (!pasaje) {
      throw new NotFoundException('Pasaje no encontrado.');
    }

    if (pasaje.placaVehiculo !== usuario.placaAsignada) {
      throw new BadRequestException(
        'No puedes descargar este recibo: no fue vendido en tu vehículo.',
      );
    }

    return this.pdfService.generarComprobantePasaje(pasaje);
  }

  // Precio oficial del tramo (según origen/destino) para que el monto de una
  // venta manual NUNCA pueda ser menor al precio oficial del sindicato.
  private async obtenerPrecioOficialTramo(origen?: string, destino?: string) {
    const precios = await this.secretariaService.obtenerPreciosVenta();

    const desde = (origen || '').trim().toLowerCase();
    const hasta = (destino || '').trim().toLowerCase();

    if (desde.includes('cochabamba') && hasta.includes('eterazama')) {
      return Number(precios.cochabamba);
    }
    if (desde.includes('eterazama') && hasta.includes('cochabamba')) {
      return Number(precios.eterazama);
    }

    const texto = `${desde} ${hasta}`;
    if (texto.includes('cochabamba')) return Number(precios.cochabamba);
    if (texto.includes('eterazama')) return Number(precios.eterazama);

    throw new BadRequestException(
      'No se pudo determinar el tramo de la venta para validar el precio oficial.',
    );
  }

  async ventaManual(choferId: string, data: {
    pasajeroNombre: string;
    asiento: number;
    origen: string;
    destino: string;
    monto: number;
    montoEncomienda?: number;
    contactoRecibo?: string;
  }) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    // Regla de choferes activos: un chofer INACTIVO no puede vender pasajes.
    if (usuario.estado !== 'activo') {
      throw new BadRequestException(
        'No puedes vender pasajes porque tu estado de servicio está INACTIVO. Activa tu estado desde tu panel para poder vender.',
      );
    }

    const placa = usuario.placaAsignada;

    // El monto de una venta manual NO puede ser arbitrario: se valida contra
    // el precio oficial del tramo y se rechazan montos negativos/cero.
    const precioOficial = await this.obtenerPrecioOficialTramo(
      data.origen,
      data.destino,
    );
    const monto = Number(data.monto);
    const montoEncomienda = Number(data.montoEncomienda || 0);

    if (!Number.isFinite(monto) || monto < precioOficial) {
      throw new BadRequestException(
        `El monto del boleto no puede ser menor al precio oficial del tramo (Bs ${precioOficial}).`,
      );
    }
    if (!Number.isFinite(montoEncomienda) || montoEncomienda < 0) {
      throw new BadRequestException(
        'El monto de la encomienda no puede ser negativo.',
      );
    }

    // Operación atómica: se bloquea el vehículo PRIMERO (pessimistic_write),
    // se releen sus asientosOcupados/asientosChofer desde PostgreSQL bajo ese
    // lock y se validan contra ese estado real. Solo entonces se crea el
    // boleto y el pasaje y se actualizan el viaje y el vehículo, todo dentro
    // de la MISMA transacción. Si otra compra (boletería o pasajero) ocupa el
    // mismo asiento de forma simultánea, TypeORM/PostgreSQL serializan ambas
    // operaciones sobre la misma fila del vehículo: la segunda releerá el
    // estado actualizado y lanzará un error, haciendo rollback automático.
    const resultadoVenta =
      await this.dataSource.transaction(async (manager) => {
        const vehiculoRepo = manager.getRepository(Vehiculo);
        const boletoRepo = manager.getRepository(Boleto);
        const pasajeRepo = manager.getRepository(Pasaje);
        const viajeRepo = manager.getRepository(Viaje);

        const vehiculo = await vehiculoRepo.findOne({
          where: { placa },
          lock: { mode: 'pessimistic_write' },
        });

        if (!vehiculo) {
          throw new NotFoundException('No tiene vehiculo asignado');
        }

        // Rango permitido de asientos: 1..capacidad real del vehículo.
        if (
          !Number.isInteger(data.asiento) ||
          data.asiento < 1 ||
          data.asiento > vehiculo.capacidadTotal
        ) {
          throw new BadRequestException(
            `El asiento ${data.asiento} está fuera del rango permitido (1-${vehiculo.capacidadTotal}).`,
          );
        }

        // Un vehículo POR SALIR ya no recibe ventas: le queda solo partir.
        if (vehiculo.estadoViaje === 'por_salir') {
          throw new BadRequestException(
            'Este vehículo está POR SALIR y ya no recibe ventas de pasajes.',
          );
        }

        // Regla A4: solo el chofer que ocupa el PUESTO 1 de la fila de su
        // parada puede cargar pasajeros y recibir ventas de pasajes.
        if (vehiculo.paradaActual !== 'cochabamba' && vehiculo.paradaActual !== 'eterazama') {
          throw new BadRequestException(
            'Este vehículo no está anotado en ninguna fila y no puede vender pasajes.',
          );
        }
        if (vehiculo.puestoFila !== 1) {
          throw new BadRequestException(
            `Solo el chofer que ocupa el PUESTO 1 puede cargar pasajeros y vender pasajes. Este vehículo (${vehiculo.placa}) ocupa el puesto ${vehiculo.puestoFila}.`,
          );
        }

        const viaje = await viajeRepo.findOne({
          where: {
            placaVehiculo: placa,
          },
          order: { fechaCreacion: 'DESC' },
        });

        if (!viaje) {
          throw new BadRequestException('No hay viaje activo para vender pasajes');
        }

        const existente = await boletoRepo.findOne({
          where: {
            viajeId: viaje.id,
            asiento: data.asiento,
          },
        });

        if (existente) {
          throw new BadRequestException(`El asiento ${data.asiento} ya esta ocupado`);
        }

        const asientosChoferSet = new Set(vehiculo.asientosChofer || []);
        if (asientosChoferSet.has(data.asiento)) {
          throw new BadRequestException(
            `El asiento ${data.asiento} pertenece al chofer y no está disponible para la venta.`,
          );
        }

        const asientosOcupadosSet = new Set(vehiculo.asientosOcupados || []);
        if (asientosOcupadosSet.has(data.asiento)) {
          throw new BadRequestException(
            `El asiento ${data.asiento} ya está ocupado y no está disponible para la venta.`,
          );
        }

        const boleto = boletoRepo.create({
          pasajeroNombre: data.pasajeroNombre,
          pasajeroTelefono: data.contactoRecibo,
          placaVehiculo: placa,
          viajeId: viaje.id,
          asiento: data.asiento,
          origen: data.origen,
          destino: data.destino,
          monto: data.monto,
          estadoBoleto: 'abordado',
          estadoPago: 'pagado',
          escaneado: true,
          contactoRecibo: data.contactoRecibo,
        });

        const boletoGuardado =
          await boletoRepo.save(boleto);

        const pasaje = pasajeRepo.create({
          pasajeroNombre: data.pasajeroNombre,
          placaVehiculo: placa,
          asientos: [data.asiento],
          montoAsientos: data.monto,
          montoEncomienda: data.montoEncomienda || 0,
          montoTotal: data.monto + (data.montoEncomienda || 0),
          tramo: `${data.origen} -> ${data.destino}`,
          contactoRecibo: data.contactoRecibo,
        });

        await pasajeRepo.save(pasaje);

        viaje.asientosOcupados = viaje.asientosOcupados + 1;
        viaje.totalGenerado = Number(viaje.totalGenerado) + data.monto + (data.montoEncomienda || 0);
        viaje.pasajerosTransportados = viaje.pasajerosTransportados + 1;
        await viajeRepo.save(viaje);

        const nuevos = Array.from(new Set([...vehiculo.asientosOcupados, data.asiento]));
        vehiculo.asientosOcupados = nuevos;
        await vehiculoRepo.save(vehiculo);

        // AUTO programación de salida (si esta venta llena el vehículo): en la
        // MISMA transacción de la venta.
        const salida = await this.salidasService.programarSalidaEnTransaccion(
          manager,
          vehiculo.id,
          { manual: false },
        );

        return { boletoGuardado, salida };
      });

    // Se notifica SOLO después de que la transacción hizo commit.
    this.flotaGateway.notificarCambioFlota();

    if (resultadoVenta.salida.aplicada) {
      this.salidasService.emitirNotificaciones(resultadoVenta.salida);
    }

    return resultadoVenta.boletoGuardado;
  }


  // =============================================
  // 7. VALIDACION QR
  // =============================================

  async validarBoletoQR(choferId: string, codigoQR: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    let boleto = await this.boletoRepo.findOne({
      where: { codigoQR },
    });

    if (!boleto) {
      const boletos = await this.boletoRepo.find();
      const encontrado = boletos.find(b => b.id === codigoQR || b.id.substring(0, 8) === codigoQR);
      if (encontrado) boleto = encontrado;
    }

    if (!boleto) {
      throw new NotFoundException('Boleto no encontrado en el sistema');
    }

    if (boleto.escaneado) {
      throw new BadRequestException('Este boleto ya fue utilizado. No puede escanearse dos veces.');
    }

    if (boleto.placaVehiculo !== usuario.placaAsignada) {
      throw new BadRequestException(`Este boleto corresponde al vehiculo ${boleto.placaVehiculo}, no al suyo (${usuario.placaAsignada})`);
    }

    return {
      valido: true,
      boleto: {
        id: boleto.id,
        pasajeroNombre: boleto.pasajeroNombre,
        asiento: boleto.asiento,
        origen: boleto.origen,
        destino: boleto.destino,
        monto: boleto.monto,
        estadoPago: boleto.estadoPago,
        estadoBoleto: boleto.estadoBoleto,
      },
    };
  }

  async confirmarAbordajeQR(choferId: string, boletoId: string) {
    const usuario = await this.obtenerUsuarioAsignado(choferId);

    const boleto = await this.boletoRepo.findOne({
      where: { id: boletoId },
    });

    if (!boleto) {
      throw new NotFoundException('Boleto no encontrado');
    }

    // Regla de propiedad: solo el chofer del MISMO vehículo puede gestionar
    // el boleto.
    if (boleto.placaVehiculo !== usuario.placaAsignada) {
      throw new BadRequestException(
        `Este boleto corresponde al vehículo ${boleto.placaVehiculo}, no al suyo (${usuario.placaAsignada}).`,
      );
    }

    if (boleto.escaneado) {
      throw new BadRequestException('Este boleto ya fue utilizado');
    }

    if (boleto.estadoPago !== 'pagado') {
      throw new BadRequestException('El boleto no esta pagado');
    }

    boleto.escaneado = true;
    boleto.estadoBoleto = 'abordado';
    await this.boletoRepo.save(boleto);

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: boleto.placaVehiculo },
    });
    if (vehiculo) {
      const nuevos = Array.from(new Set([...vehiculo.asientosOcupados, boleto.asiento]));
      vehiculo.asientosOcupados = nuevos;
      await this.vehiculoRepo.save(vehiculo);
    }

    return { success: true, mensaje: 'Abordaje confirmado correctamente' };
  }


  // =============================================
  // 7.1 VALIDACION DE BOLETO POR CODIGO DE BARRAS (boleteria / pasaje)
  // =============================================
  //
  // Valida un boleto de boleteria (entidad Pasaje) contra la base de datos
  // usando su codigo de barras unico. Devuelve un estado tipificado para que
  // el frontend muestre el color correcto:
  //   valido      -> verde
  //   utilizado   -> naranja
  //   reembolsado -> rojo
  //   cancelado   -> rojo
  //   inexistente -> rojo
  //   otro_vehiculo -> rojo
  //

  async validarBoletoPorBarras(choferId: string, codigoBarras: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const codigo = String(codigoBarras || '').trim();
    if (!codigo) {
      return { estado: 'inexistente', mensaje: 'Código de barras vacío.' };
    }

    let pasaje = await this.pasajeRepo.findOne({
      where: { codigoBarras: codigo },
    });

    if (!pasaje) {
      pasaje = await this.pasajeRepo.findOne({
        where: { codigo },
      });
    }

    if (!pasaje) {
      const todos = await this.pasajeRepo.find();
      const porId = todos.find(
        (p) =>
          p.id === codigo ||
          p.id.substring(0, 8).toUpperCase() === codigo.toUpperCase(),
      );
      if (porId) pasaje = porId;
    }

    if (!pasaje) {
      return {
        estado: 'inexistente',
        mensaje: 'Boleto no encontrado. Verifique el código de barras.',
      };
    }

    if (pasaje.placaVehiculo !== usuario.placaAsignada) {
      return {
        estado: 'otro_vehiculo',
        mensaje: `Este boleto corresponde al vehículo ${pasaje.placaVehiculo}, no al suyo (${usuario.placaAsignada}).`,
      };
    }

    if (
      pasaje.estadoBoleto === 'REEMBOLSADO' ||
      pasaje.estadoReembolso === 'REEMBOLSADO'
    ) {
      return {
        estado: 'reembolsado',
        mensaje: 'Este boleto fue cancelado o reembolsado. Ya no es válido.',
      };
    }

    if (pasaje.estadoBoleto === 'CANCELADO') {
      return {
        estado: 'cancelado',
        mensaje: 'Este boleto fue cancelado. Ya no es válido.',
      };
    }

    if (pasaje.estadoBoleto === 'UTILIZADO' || pasaje.fechaEscaneo) {
      return {
        estado: 'utilizado',
        mensaje: 'Este boleto ya fue utilizado. No puede usarse nuevamente.',
      };
    }

    return {
      estado: 'valido',
      mensaje: 'Boleto válido.',
      boleto: {
        id: pasaje.id,
        codigo: pasaje.codigo,
        pasajeroNombre: pasaje.pasajeroNombre,
        asientos: pasaje.asientos,
        origen: pasaje.origen,
        destino: pasaje.destino,
        estadoBoleto: pasaje.estadoBoleto,
      },
    };
  }

  async confirmarBoletoUtilizado(choferId: string, pasajeId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const pasaje = await this.pasajeRepo.findOne({
      where: { id: pasajeId },
    });

    if (!pasaje) {
      throw new NotFoundException('Boleto no encontrado');
    }

    if (pasaje.placaVehiculo !== usuario.placaAsignada) {
      throw new BadRequestException('Este boleto no corresponde a su vehículo.');
    }

    if (pasaje.estadoBoleto === 'UTILIZADO' || pasaje.fechaEscaneo) {
      throw new BadRequestException('Este boleto ya fue utilizado.');
    }

    if (
      pasaje.estadoBoleto === 'REEMBOLSADO' ||
      pasaje.estadoReembolso === 'REEMBOLSADO' ||
      pasaje.estadoBoleto === 'CANCELADO'
    ) {
      throw new BadRequestException(
        'Este boleto fue cancelado o reembolsado. No puede utilizarse.',
      );
    }

    pasaje.estadoBoleto = 'UTILIZADO';
    pasaje.fechaEscaneo = new Date();
    pasaje.escaneadoPor = usuario.nombreUsuario || usuario.id;

    await this.pasajeRepo.save(pasaje);
    this.flotaGateway.notificarCambioFlota();

    return {
      success: true,
      mensaje: 'Boleto marcado como utilizado correctamente.',
    };
  }


  // =============================================
  // 8. ESTADO DEL VEHICULO (trufi) Y DEL VIAJE
  // =============================================
  //
  // Estado del trufi  -> estadoVehiculo : RESERVADO PARA 'activo' | 'inactivo'
  // Estado del viaje  -> estadoViaje    : 'en_ruta' | 'fin_de_ruta' | 'mantenimiento'
  //
  // Ambos estados son independientes y NO deben mezclarse.

  // 8.1 ESTADO DEL TRUFI (operativo): ACTIVO / INACTIVO
  async cambiarEstadoVehiculo(choferId: string, nuevoEstado: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const estadosValidos = ['activo', 'inactivo'];
    if (!estadosValidos.includes(nuevoEstado)) {
      throw new BadRequestException('Estado del trufi no valido');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    vehiculo.estadoVehiculo = nuevoEstado;

    if (nuevoEstado === 'inactivo') {
      // Al inactivar: limpiar asientosOcupados (no hay viaje activo posible).
      // Los pasajes/viajes anteriores quedan en el historial de PostgreSQL.
      vehiculo.asientosOcupados = this.asientosFinalizados(vehiculo);
      vehiculo.estadoViaje = 'listo';
      await this.sacarDeFila(vehiculo);
    }

    // ACTIVO deja el vehiculo listo para operar: saca del estado de
    // mantenimiento y devuelve los asientos de pasajeros disponibles.
    if (nuevoEstado === 'activo') {
      vehiculo.estadoViaje = 'listo';
    }

    vehiculo.fechaEstado = new Date();
    await this.vehiculoRepo.save(vehiculo);

    this.flotaGateway.notificarCambioFlota();

    await this.crearNotificacion(
      choferId,
      'estado_vehiculo',
      'Estado del trufi actualizado',
      nuevoEstado === 'activo'
        ? 'Su trufi volvio a estar ACTIVO y queda disponible para operar.'
        : 'Su trufi quedo INACTIVO. No podra anotarse en ninguna fila mientras permanezca inactivo.',
    );

    return {
      estadoVehiculo: vehiculo.estadoVehiculo,
      estadoViaje: vehiculo.estadoViaje,
      paradaActual: vehiculo.paradaActual,
      fechaEstado: vehiculo.fechaEstado,
    };
  }

  // 8.2 ESTADO DEL VIAJE: EN RUTA / FIN DE LA RUTA / MANTENIMIENTO
  async cambiarEstadoViaje(choferId: string, nuevoEstado: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const placa = usuario.placaAsignada;

    const estadosValidos = ['en_ruta', 'fin_de_ruta', 'mantenimiento'];
    if (!estadosValidos.includes(nuevoEstado)) {
      throw new BadRequestException('Estado del viaje no valido');
    }

    let vehiculo = await this.vehiculoRepo.findOne({
      where: { placa },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    if (nuevoEstado === 'en_ruta') {
      // INICIO DE RUTA: transaccional y con lock. Se serializa con la fila de
      // la parada (para que la reindexación no colisione) y con "por salir",
      // y se re-chequea bajo el lock para que un doble clic NUNCA repita la
      // salida ni duplique notificaciones.
      const resultadoRutaEnRuta = await this.dataSource.transaction(async (manager) => {
        const vehiculoRepo = manager.getRepository(Vehiculo);

        const vRef = await vehiculoRepo.findOne({ where: { placa } });
        if (!vRef) {
          throw new NotFoundException('Vehiculo no encontrado');
        }

        const lockKey =
          vRef.paradaActual === 'cochabamba'
            ? 771001
            : vRef.paradaActual === 'eterazama'
            ? 771002
            : 771100;
        await manager.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

        const vLock = await vehiculoRepo.findOne({
          where: { placa },
          lock: { mode: 'pessimistic_write' },
        });

        if (!vLock) {
          throw new NotFoundException('Vehiculo no encontrado');
        }

        // Re-chequeo bajo el lock: ya está EN RUTA (doble clic o llegada del
        // temporizador) => no se vuelve a ejecutar nada.
        if (vLock.estadoViaje === 'en_ruta' || vLock.paradaActual === 'en_ruta') {
          return null;
        }

        if (vLock.estadoViaje === 'mantenimiento') {
          throw new BadRequestException(
            'El vehículo está en mantenimiento y no puede iniciar la ruta.',
          );
        }

        const res = await this.salidasService.transicionarEnRutaEnTransaccion(
          manager,
          vLock,
        );
        return res;
      });

      const resultadoEnRuta = resultadoRutaEnRuta;

      if (resultadoEnRuta) {
        this.salidasService.emitirNotificaciones(resultadoEnRuta);
      }

      // Releer el vehículo con el estado real dejado por la transacción.
      const actualizado = await this.vehiculoRepo.findOne({ where: { placa } });
      if (!actualizado) {
        throw new NotFoundException('Vehiculo no encontrado');
      }
      vehiculo = actualizado;
    } else if (nuevoEstado === 'fin_de_ruta') {
      if (vehiculo.estadoViaje === 'por_salir') {
        throw new BadRequestException(
          'El vehículo está POR SALIR. Debe iniciar la ruta antes de finalizarla.',
        );
      }
      vehiculo.estadoViaje = 'fin_de_ruta';
      vehiculo.estadoVehiculo = 'activo';
      // Al finalizar la ruta se liberan SOLO los asientos de pasajeros para
      // el siguiente viaje; los asientos del chofer (asientosChofer) se
      // conservan tal como están configurados, sin fallback [1,2]. Se ejecuta
      // en una transacción con lock pesimista del vehículo para serializar
      // con registrarVenta()/ventaManual() y evitar estados inconsistentes.
      const vehiculoFinalizado =
        await this.dataSource.transaction(async (manager) => {
          const vehiculoRepo = manager.getRepository(Vehiculo);
          const viajeRepo = manager.getRepository(Viaje);
          const boletoRepo = manager.getRepository(Boleto);

          const vehiculoLock = await vehiculoRepo.findOne({
            where: { placa },
            lock: { mode: 'pessimistic_write' },
          });

          if (!vehiculoLock) {
            throw new NotFoundException('Vehiculo no encontrado');
          }

          const viajeLock = await viajeRepo.findOne({
            where: { placaVehiculo: placa },
            order: { fechaCreacion: 'DESC' },
          });

          if (viajeLock) {
            viajeLock.estado = 'finalizado';
            viajeLock.horaLlegada = viajeLock.horaLlegada || new Date().toTimeString().slice(0, 5);
            const boletos = await boletoRepo.find({
              where: { viajeId: viajeLock.id },
            });
            viajeLock.pasajerosTransportados = boletos.length;
            viajeLock.totalGenerado = boletos.reduce((acc, b) => acc + Number(b.monto), 0);
            viajeLock.asientosOcupados = boletos.length;
            await viajeRepo.save(viajeLock);
          }

          const paradaOrigen = vehiculoLock.paradaActual;

          vehiculoLock.asientosOcupados = this.asientosFinalizados(vehiculoLock);
          vehiculoLock.estadoViaje = 'fin_de_ruta';
          vehiculoLock.estadoVehiculo = 'activo';
          // Al finalizar la ruta el vehículo NO vuelve a la fila: queda ACTIVO
          // y FUERA DE FILA (puesto 0). Solo el chofer decide voluntariamente
          // anotarse de nuevo con "Anotarme en Cochabamba/Eterazama".
          vehiculoLock.paradaActual = 'fuera_de_fila';
          vehiculoLock.puestoFila = 0;
          vehiculoLock.horaIngresoFila = null;
          await vehiculoRepo.save(vehiculoLock);

          // Si por alguna razón estaba dentro de una fila, se reindexa esa fila
          // para que los demás choferes avancen y quede 1..N sin huecos.
          if (paradaOrigen === 'cochabamba' || paradaOrigen === 'eterazama') {
            await this.reindexarFila(paradaOrigen, manager);
          }

          return vehiculoLock;
        });

      // Tomar el estado real guardado por la transacción para el save final.
      vehiculo = vehiculoFinalizado;
      // No se elimina el historial de viajes, pasajes ni pagos anteriores.
    } else if (nuevoEstado === 'mantenimiento') {
      if (vehiculo.estadoViaje === 'por_salir') {
        throw new BadRequestException(
          'El vehículo está POR SALIR y no puede pasar a mantenimiento.',
        );
      }
      // Regla de negocio: NO permitir pasar a mantenimiento si el vehículo
      // tiene pasajeros activos (viaje en curso con asientos vendidos).
      const asientosChofer = new Set(vehiculo.asientosChofer || []);
      const pasajerosActivos = (vehiculo.asientosOcupados || []).filter(
        (a) => !asientosChofer.has(a),
      ).length;
      if (pasajerosActivos > 0 && vehiculo.estadoViaje === 'en_ruta') {
        throw new BadRequestException(
          'No se puede pasar a mantenimiento: el vehículo tiene pasajeros activos en ruta. Finalice el viaje primero.',
        );
      }
      vehiculo.estadoViaje = 'mantenimiento';
      // Limpiar asientos al entrar en mantenimiento
      vehiculo.asientosOcupados = this.asientosFinalizados(vehiculo);
      await this.sacarDeFila(vehiculo);
    }

    vehiculo.fechaEstado = new Date();
    await this.vehiculoRepo.save(vehiculo);

    this.flotaGateway.notificarCambioFlota();

    const etiquetas: Record<string, string> = {
      en_ruta: 'En ruta',
      fin_de_ruta: 'Fin de la ruta',
      mantenimiento: 'Mantenimiento',
    };

    // En EN RUTA la notificación al chofer ya la crea el flujo de salida
    // ("Salida en ruta"). Para los demás estados se mantiene la notificación.
    if (nuevoEstado !== 'en_ruta') {
      await this.crearNotificacion(
        choferId,
        'estado_viaje',
        'Estado del viaje actualizado',
        `Estado del viaje cambiado a: ${etiquetas[nuevoEstado]}`,
      );
    }

    return {
      estadoVehiculo: vehiculo.estadoVehiculo,
      estadoViaje: vehiculo.estadoViaje,
      paradaActual: vehiculo.paradaActual,
      fechaEstado: vehiculo.fechaEstado,
    };
  }

  private async sacarDeFila(vehiculo: Vehiculo) {
    if (vehiculo.paradaActual === 'cochabamba' || vehiculo.paradaActual === 'eterazama') {
      const paradaAnterior = vehiculo.paradaActual;
      vehiculo.paradaActual = 'fuera_de_fila';
      vehiculo.puestoFila = 0;
      vehiculo.horaIngresoFila = null;
      await this.vehiculoRepo.save(vehiculo);
      await this.reindexarFila(paradaAnterior);
    }
    return vehiculo;
  }

  // 8.3 PROGRAMAR SALIDA (POR SALIR): delega en el módulo de salidas. Solo el
  // chofer del puesto 1 puede; es idempotente (sin doble activación).
  async programarSalidaChofer(choferId: string) {
    return this.salidasService.programarSalida(choferId);
  }


  // =============================================
  // 9. LIQUIDACION
  // =============================================

  async obtenerLiquidacion(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const viajes = await this.viajeRepo.find({
      where: { placaVehiculo: usuario.placaAsignada || '' },
      order: { fechaCreacion: 'DESC' },
    });

    const liquidaciones = await this.liquidacionRepo.find({
      where: { choferId },
      order: { fechaCreacion: 'DESC' },
    });

    const totalViajes = viajes.length;
    const totalPasajeros = viajes.reduce((acc, v) => acc + v.pasajerosTransportados, 0);
    const totalPasajes = viajes.reduce((acc, v) => acc + Number(v.totalGenerado), 0);

    const pasajes = await this.pasajeRepo.find({
      where: { placaVehiculo: usuario.placaAsignada || '' },
    });
    const totalEncomiendas = pasajes.reduce((acc, p) => acc + Number(p.montoEncomienda || 0), 0);

    return {
      resumen: {
        totalViajes,
        totalPasajeros,
        totalPasajes,
        totalEncomiendas,
        totalGenerado: totalPasajes + totalEncomiendas,
        montoLiquidado: liquidaciones
          .filter(l => l.estado === 'liquidado')
          .reduce((acc, l) => acc + Number(l.montoLiquidado), 0),
        estadoLiquidacion: liquidaciones.length > 0 ? liquidaciones[0].estado : 'sin datos',
      },
      liquidacionesAnteriores: liquidaciones,
    };
  }


  // =============================================
  // 10. HISTORIAL DE VIAJES
  // =============================================

  async obtenerHistorialViajes(choferId: string, filtro?: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const viajes = await this.viajeRepo.find({
      where: { placaVehiculo: usuario.placaAsignada },
      order: { fechaCreacion: 'DESC' },
    });

    if (!filtro || filtro === 'todos') {
      return viajes;
    }

    const ahora = new Date();
    let fechaInicio: Date;

    if (filtro === 'dia') {
      fechaInicio = new Date(ahora);
      fechaInicio.setHours(0, 0, 0, 0);
    } else if (filtro === 'semana') {
      fechaInicio = new Date(ahora);
      fechaInicio.setDate(fechaInicio.getDate() - 7);
    } else if (filtro === 'mes') {
      fechaInicio = new Date(ahora);
      fechaInicio.setMonth(fechaInicio.getMonth() - 1);
    } else {
      return viajes;
    }

    return viajes.filter(v => new Date(v.fechaCreacion) >= fechaInicio);
  }


  // =============================================
  // 11. MIS CALIFICACIONES
  // =============================================

  async obtenerMisCalificaciones(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    if (!vehiculo) {
      throw new NotFoundException('Vehiculo no encontrado');
    }

    const reviews = await this.reviewRepo.find({
      where: { vehiculoId: vehiculo.id },
      order: { fechaCreacion: 'DESC' },
    });

    const promedio = reviews.length > 0
      ? Number((reviews.reduce((acc, r) => acc + r.estrellas, 0) / reviews.length).toFixed(2))
      : 0;

    return {
      promedioEstrellas: promedio,
      cantidadCalificaciones: reviews.length,
      calificaciones: reviews.map(r => ({
        id: r.id,
        estrellas: r.estrellas,
        comentario: r.comentario,
        fechaCreacion: r.fechaCreacion,
      })),
    };
  }


  // =============================================
  // 12. MIS ESTADISTICAS
  // =============================================

  async obtenerMisEstadisticas(choferId: string, periodo?: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario || !usuario.placaAsignada) {
      throw new NotFoundException('No tiene vehiculo asignado');
    }

    const viajes = await this.viajeRepo.find({
      where: { placaVehiculo: usuario.placaAsignada },
      order: { fechaCreacion: 'DESC' },
    });

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });

    let viajesFiltrados = viajes;
    if (periodo && periodo !== 'todos') {
      const ahora = new Date();
      let fechaInicio: Date;

      if (periodo === 'dia') {
        fechaInicio = new Date(ahora);
        fechaInicio.setHours(0, 0, 0, 0);
      } else if (periodo === 'semana') {
        fechaInicio = new Date(ahora);
        fechaInicio.setDate(fechaInicio.getDate() - 7);
      } else if (periodo === 'mes') {
        fechaInicio = new Date(ahora);
        fechaInicio.setMonth(fechaInicio.getMonth() - 1);
      } else {
        fechaInicio = new Date(0);
      }

      viajesFiltrados = viajes.filter(v => new Date(v.fechaCreacion) >= fechaInicio);
    }

    const totalViajes = viajesFiltrados.length;
    const totalPasajeros = viajesFiltrados.reduce((acc, v) => acc + v.pasajerosTransportados, 0);
    const promedioPasajeros = totalViajes > 0 ? Number((totalPasajeros / totalViajes).toFixed(1)) : 0;

    const reviews = await this.reviewRepo.find({
      where: { vehiculoId: vehiculo?.id || 0 },
    });

    const promedioCalificacion = reviews.length > 0
      ? Number((reviews.reduce((acc, r) => acc + r.estrellas, 0) / reviews.length).toFixed(2))
      : 0;

    const graficoViajes = viajesFiltrados.map(v => ({
      fecha: v.fecha,
      viajes: 1,
      pasajeros: v.pasajerosTransportados,
      generado: Number(v.totalGenerado),
    }));

    return {
      totalViajes,
      totalPasajeros,
      promedioPasajerosPorViaje: promedioPasajeros,
      promedioCalificacion,
      cantidadResenas: reviews.length,
      graficoViajes,
    };
  }


  // =============================================
  // 13. NOTIFICACIONES
  // =============================================

  async obtenerNotificaciones(choferId: string) {
    return this.notificacionRepo.find({
      where: { choferId },
      order: { fechaCreacion: 'DESC' },
    });
  }

  async marcarNotificacionLeida(choferId: string, notificacionId: string) {
    const notificacion = await this.notificacionRepo.findOne({
      where: { id: notificacionId, choferId },
    });

    if (!notificacion) {
      throw new NotFoundException('Notificacion no encontrada');
    }

    notificacion.leida = true;
    return this.notificacionRepo.save(notificacion);
  }

  async marcarTodasLeidas(choferId: string) {
    await this.notificacionRepo.update(
      { choferId, leida: false },
      { leida: true },
    );
    return { success: true };
  }

  private async crearNotificacion(choferId: string, tipo: string, titulo: string, mensaje: string) {
    const notificacion = this.notificacionRepo.create({
      choferId,
      tipo,
      titulo,
      mensaje,
    });
    return this.notificacionRepo.save(notificacion);
  }


  // =============================================
  // 14. PERFIL
  // =============================================

  async obtenerPerfil(choferId: string) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      id: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      gmail: usuario.gmail,
      telefono: usuario.telefono,
      rol: usuario.rol,
      estado: usuario.estado,
      placaAsignada: usuario.placaAsignada,
      fechaRegistro: usuario.fechaRegistro,
    };
  }

  async actualizarPerfil(choferId: string, data: {
    nombre?: string;
    apellidos?: string;
    telefono?: string;
  }) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (data.nombre !== undefined) usuario.nombre = data.nombre.trim();
    if (data.apellidos !== undefined) usuario.apellidos = data.apellidos.trim();
    if (data.telefono !== undefined) {
      const telefono = data.telefono.trim();
      if (telefono) {
        const existe = await this.usuarioRepo.findOne({
          where: { telefono },
        });
        if (existe && existe.id !== choferId) {
          throw new BadRequestException('El telefono ya esta registrado en otra cuenta');
        }
      }
      usuario.telefono = telefono || null;
    }

    await this.usuarioRepo.save(usuario);

    return {
      id: usuario.id,
      nombreUsuario: usuario.nombreUsuario,
      nombre: usuario.nombre,
      apellidos: usuario.apellidos,
      gmail: usuario.gmail,
      telefono: usuario.telefono,
      rol: usuario.rol,
      estado: usuario.estado,
      placaAsignada: usuario.placaAsignada,
    };
  }

}
