import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';

import { Usuario } from '../auth/usuario.entity';
import { ROLES } from '../auth/roles';
import { Vehiculo } from '../flota/vehiculo.entity';
import { SolicitudRetiro } from '../flota/solicitud-retiro.entity';
import { Pasaje } from '../pasajes/pasaje.entity';
import { Review } from '../reviews/review.entity';
import { Viaje } from '../chofer/entities/viaje.entity';
import { FlotaGateway } from '../flota/flota.gateway';
import { Configuracion } from './entities/configuracion.entity';
import { VentaBoleteriaDto } from './dto/vender-boleteria.dto';
import { VentaManualChoferDto } from '../chofer/dto/venta-manual-chofer.dto';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto';
import { normalizarConfiguracionAsientos, obtenerAsientosDistribuidos } from '../flota/asientos-config.util';
import { NotificacionPasajero } from '../notificaciones/notificacion-pasajero.entity';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { SalidasService } from '../salidas/salidas.service';
import {
  AuditoriaService,
  ActorAuditoria,
} from '../auditoria/auditoria.service';
import {
  reindexarFilaOficial,
  calcularPuestosFila,
} from '../flota/fila.util';

const NOMBRES_PARADAS: Record<string, string> = {
  cochabamba: 'Cochabamba',
  eterazama: 'Eterazama',
};

const PRECIOS_INICIALES = {
  cochabamba: 20,
  eterazama: 15,
};

@Injectable()
export class SecretariaService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,

    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,

    @InjectRepository(Pasaje)
    private readonly pasajeRepo: Repository<Pasaje>,

    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,

    @InjectRepository(Viaje)
    private readonly viajeRepo: Repository<Viaje>,

    @InjectRepository(Configuracion)
    private readonly configRepo: Repository<Configuracion>,

    @InjectRepository(SolicitudRetiro)
    private readonly solicitudRetiroRepo: Repository<SolicitudRetiro>,

    private readonly dataSource: DataSource,

    private readonly flotaGateway: FlotaGateway,

    private readonly notificacionesService: NotificacionesService,

    private readonly salidasService: SalidasService,

    private readonly auditoriaService: AuditoriaService,
  ) {}

  // =============================================================
  // 1. NÓMINA DE CHOFERES
  // Datos 100% desde PostgreSQL, sin datos ficticios.
  // =============================================================

  async obtenerNomina() {
    const choferes = await this.usuarioRepo.find({
      where: { rol: ROLES.CHOFER },
      select: {
        id: true,
        nombreUsuario: true,
        nombre: true,
        apellidos: true,
        gmail: true,
        telefono: true,
        ci: true,
        rol: true,
        estado: true,
        placaAsignada: true,
        fechaRegistro: true,
      },
      order: { fechaRegistro: 'DESC' },
    });

    const vehiculos = await this.vehiculoRepo.find();
    const viajes = await this.viajeRepo.find();

    const nomina = await Promise.all(
      choferes.map(async (usuario) => {
        const placa = usuario.placaAsignada;
        const vehiculo = placa
          ? vehiculos.find((v) => v.placa === placa)
          : null;

        const placas: string[] = placa ? [placa] : [];

        // Cantidad de viajes: viajes registrados para las placas del chofer
        let totalViajes = 0;
        if (placas.length > 0) {
          totalViajes = viajes.filter((v) =>
            placas.includes(v.placaVehiculo),
          ).length;
        }

        // Reseñas del vehículo del chofer
        let reviews: Review[] = [];
        let promedioCalificacion = 0;
        let cantidadResenas = 0;

        if (vehiculo) {
          reviews = await this.reviewRepo.find({
            where: { vehiculoId: vehiculo.id },
          });
          cantidadResenas = reviews.length;
          promedioCalificacion =
            cantidadResenas > 0
              ? Number(
                  (
                    reviews.reduce((acc, r) => acc + r.estrellas, 0) /
                    cantidadResenas
                  ).toFixed(2),
                )
              : 0;
        }

        const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellidos || ''}`
          .trim();

        return {
          id: usuario.id,
          nombreCompleto: nombreCompleto || usuario.nombreUsuario,
          nombreUsuario: usuario.nombreUsuario,
          ci: usuario.ci || '',
          telefono: usuario.telefono || '',
          gmail: usuario.gmail,
          estado: usuario.estado,
          vehiculo: vehiculo
            ? `${vehiculo.tipoVehiculo} ${vehiculo.color}`.trim()
            : null,
          placa: placa || null,
          vehiculoId: vehiculo?.id ?? null,
          tipoVehiculo: vehiculo?.tipoVehiculo || null,
          color: vehiculo?.color || null,
          capacidadTotal: vehiculo?.capacidadTotal ?? null,
          paradaActual: vehiculo?.paradaActual || null,
          estadoVehiculo: vehiculo?.estadoVehiculo || null,
          totalViajes,
          promedioCalificacion,
          cantidadResenas,
        };
      }),
    );

    return nomina;
  }

  // =============================================================
  // 1.1 CHOFERES ACTIVOS (estado operativo en tiempo real)
  // Submenú de Secretaría: muestra SOLO choferes oficiales registrados en
  // Nómina (nunca vehículos huérfanos), con su estado de servicio, ubicación,
  // estado de fila, puesto, pasajeros actuales y estado del viaje. Consume el
  // WebSocket de flota para actualizarse sin recargar la página.
  // =============================================================

  async obtenerChoferesActivos() {
    const choferes = await this.usuarioRepo.find({
      where: { rol: ROLES.CHOFER },
      select: {
        id: true,
        nombreUsuario: true,
        nombre: true,
        apellidos: true,
        rol: true,
        estado: true,
        placaAsignada: true,
      },
      order: { fechaRegistro: 'DESC' },
    });

    const vehiculos = await this.vehiculoRepo.find();
    const placasOficiales = new Set(
      choferes
        .map((c) => c.placaAsignada)
        .filter((p): p is string => !!p),
    );
    const placasActivas = new Set(
      choferes
        .filter((c) => c.estado === 'activo')
        .map((c) => c.placaAsignada)
        .filter((p): p is string => !!p),
    );

    // Posiciones reales de fila (solo anotados + oficiales activos).
    const puestosReales = new Map<string, number>();
    for (const parada of ['cochabamba', 'eterazama']) {
      for (const [placa, puesto] of calcularPuestosFila(
        vehiculos,
        parada,
        placasActivas,
      )) {
        puestosReales.set(placa, puesto);
      }
    }

    const viajes = await this.viajeRepo.find();
    const viajeActivoPorPlaca = new Map<string, Viaje>();
    for (const via of viajes) {
      if (via.estado !== 'programado' && via.estado !== 'en_ruta') continue;
      const previo = viajeActivoPorPlaca.get(via.placaVehiculo);
      if (
        !previo ||
        new Date(via.fechaCreacion).getTime() >
          new Date(previo.fechaCreacion).getTime()
      ) {
        viajeActivoPorPlaca.set(via.placaVehiculo, via);
      }
    }

    return choferes.map((c) => {
      const placa = c.placaAsignada;
      const vehiculo = placa ? vehiculos.find((v) => v.placa === placa) : null;
      if (!vehiculo) {
        return {
          id: c.id,
          choferNombre: c.nombre || c.apellidos || c.nombreUsuario,
          placa: null,
          estadoServicio: 'inactivo',
          ubicacion: 'fuera_de_fila',
          estadoFila: 'fuera',
          puestoFila: 0,
          pasajeros: 0,
          estadoDelViaje: 'listo',
          estadoVehiculo: c.estado,
          noAnotado: true,
        };
      }

      const choferSeats = vehiculo.asientosChofer || [];
      const ocupados = (vehiculo.asientosOcupados || []).filter(
        (a) => !choferSeats.includes(a),
      ).length;
      const puestoReal = puestosReales.get(vehiculo.placa) ?? 0;
      const esAnotado = puestoReal > 0 && (vehiculo.puestoFila || 0) > 0;

      // Estado operativo derivado, consistente con lo que ve el chofer.
      let estadoDelViaje = vehiculo.estadoViaje || 'listo';
      if (c.estado !== 'activo') estadoDelViaje = 'inactivo';
      else if (vehiculo.estadoViaje === 'fin_de_ruta') estadoDelViaje = 'fin_de_ruta';

      return {
        id: c.id,
        choferNombre: c.nombre || c.apellidos || c.nombreUsuario,
        placa: vehiculo.placa,
        estadoServicio: c.estado,
        ubicacion: vehiculo.paradaActual,
        estadoFila: esAnotado
          ? vehiculo.paradaActual === 'cochabamba'
            ? 'en_fila_cochabamba'
            : 'en_fila_eterazama'
          : vehiculo.paradaActual === 'cochabamba' || vehiculo.paradaActual === 'eterazama'
            ? 'ubicado'
            : 'fuera',
        puestoFila: esAnotado ? puestoReal : 0,
        pasajeros: this.pasajerosActualesChofer(
          c.estado,
          vehiculo,
          ocupados,
          puestoReal,
        ),
        estadoDelViaje,
        estadoVehiculo: vehiculo.estadoVehiculo,
        viajeActual:
          viajeActivoPorPlaca.get(vehiculo.placa) && (viajeActivoPorPlaca.get(vehiculo.placa)!.estado === 'en_ruta' || viajeActivoPorPlaca.get(vehiculo.placa)!.estado === 'programado')
            ? {
                origen: viajeActivoPorPlaca.get(vehiculo.placa)!.origen,
                destino: viajeActivoPorPlaca.get(vehiculo.placa)!.destino,
                estadoViaje: viajeActivoPorPlaca.get(vehiculo.placa)!.estado,
              }
            : null,
        noAnotado: !esAnotado,
      };
    });
  }

  // Pasajeros actuales de un vehículo para el submenú Choferes activos.
  // Misma regla que el resto del sistema: EN RUTA muestra sus pasajeros; en
  // fila solo el puesto 1; en cualquier otro estado 0.
  private pasajerosActualesChofer(
    estadoServicio: string,
    vehiculo: Vehiculo,
    ocupados: number,
    puestoReal: number,
  ): number {
    if (estadoServicio !== 'activo') return 0;
    if (vehiculo.estadoViaje === 'mantenimiento') return 0;
    if (vehiculo.estadoViaje === 'en_ruta' || vehiculo.paradaActual === 'en_ruta') {
      return ocupados;
    }
    if (vehiculo.estadoViaje === 'por_salir') return 0;
    if (
      (vehiculo.paradaActual === 'cochabamba' || vehiculo.paradaActual === 'eterazama') &&
      puestoReal !== 1
    ) {
      return 0;
    }
    return ocupados;
  }

  // =============================================================
  // 2. HISTORIAL DE VENTAS CON FILTROS
  // El total es SUMA de montoTotal (dinero, no cantidad).
  // =============================================================

  async obtenerVentas(filtros: {
    periodo?: string;
    choferId?: string;
    placa?: string;
  }) {
    let pasajes = await this.pasajeRepo.find({
      order: { fechaCreacion: 'DESC' },
    });

    // Filtro por período (día / semana / mes)
    const periodo = filtros.periodo;
    if (periodo && periodo !== 'todos' && periodo !== '') {
      const ahora = new Date();
      let fechaInicio: Date | null = null;

      if (periodo === 'dia') {
        fechaInicio = new Date(ahora);
        fechaInicio.setHours(0, 0, 0, 0);
      } else if (periodo === 'semana') {
        fechaInicio = new Date(ahora);
        fechaInicio.setDate(fechaInicio.getDate() - 7);
      } else if (periodo === 'mes') {
        fechaInicio = new Date(ahora);
        fechaInicio.setMonth(fechaInicio.getMonth() - 1);
      }

      if (fechaInicio) {
        pasajes = pasajes.filter(
          (p) => new Date(p.fechaCreacion) >= fechaInicio,
        );
      }
    }

    // Filtro por chofer: mapear al usuario -> placa del vehículo
    if (filtros.choferId) {
      const chofer = await this.usuarioRepo.findOne({
        where: { id: filtros.choferId },
      });
      if (chofer?.placaAsignada) {
        pasajes = pasajes.filter(
          (p) => p.placaVehiculo === chofer.placaAsignada,
        );
      } else {
        pasajes = [];
      }
    }

    // Filtro por vehículo (placa)
    if (filtros.placa) {
      pasajes = pasajes.filter(
        (p) => p.placaVehiculo === filtros.placa,
      );
    }

    const total = pasajes.reduce(
      (acc, p) => acc + this.montoEfectivoTotal(p),
      0,
    );

    const totalPasajes = pasajes.reduce(
      (acc, p) => acc + this.montoEfectivoAsientos(p),
      0,
    );

    const totalEncomiendas = pasajes.reduce(
      (acc, p) => acc + this.montoEfectivoEncomienda(p),
      0,
    );

    return {
      ventas: pasajes,
      resumen: {
        cantidadVentas: pasajes.length,
        totalBs: Number(total.toFixed(2)),
        totalPasajes: Number(totalPasajes.toFixed(2)),
        totalEncomiendas: Number(totalEncomiendas.toFixed(2)),
      },
    };
  }

  // =============================================================
// 2.1 DETALLE DE UNA VENTA (consultar, NUNCA modificar)
// Devuelve toda la información disponible y relacionada de una venta
// existente. No crea, no edita ni elimina ningún registro.
// =============================================================

  async obtenerDetalleVenta(id: string) {
    const venta = await this.pasajeRepo.findOneBy({ id });
    if (!venta) {
      throw new NotFoundException('Venta no encontrada.');
    }

    // Vehículo relacionado (por vehiculoId o, en su defecto, por placa).
    let vehiculo: Vehiculo | null = null;
    if (venta.vehiculoId) {
      vehiculo = await this.vehiculoRepo.findOneBy({ id: venta.vehiculoId });
    }
    if (!vehiculo && venta.placaVehiculo) {
      vehiculo = await this.vehiculoRepo.findOneBy({
        placa: venta.placaVehiculo,
      });
    }

    // Usuario (pasajero autenticado) asociado a la compra, si existe.
    const pasajeroUsuario = venta.pasajeroUsuarioId
      ? await this.usuarioRepo.findOne({
          where: { id: venta.pasajeroUsuarioId },
          select: {
            id: true,
            nombreUsuario: true,
            nombre: true,
            apellidos: true,
            gmail: true,
            telefono: true,
            rol: true,
          },
        })
      : null;

    // Precio por asiento: derivable EXACTO porque cada venta usa un único
    // precio de tramo (montoAsientos = precioUnitario * cantidad de asientos).
    let precioPorAsiento: number | null = null;
    const cantidadAsientos = (venta.asientos || []).length;
    if (cantidadAsientos > 0) {
      const totalAsientos = Number(venta.montoAsientos || 0);
      precioPorAsiento = Number((totalAsientos / cantidadAsientos).toFixed(2));
    }

    return {
      venta: { ...venta },
      vehiculo: vehiculo
        ? {
            placa: vehiculo.placa,
            tipoVehiculo: vehiculo.tipoVehiculo,
            color: vehiculo.color,
            choferNombre: vehiculo.choferNombre,
            choferCi: vehiculo.choferCi,
            capacidadTotal: vehiculo.capacidadTotal,
          }
        : null,
      pasajeroUsuario: pasajeroUsuario
        ? {
            id: pasajeroUsuario.id,
            nombreUsuario: pasajeroUsuario.nombreUsuario,
            nombre: pasajeroUsuario.nombre,
            apellidos: pasajeroUsuario.apellidos,
            gmail: pasajeroUsuario.gmail,
            telefono: pasajeroUsuario.telefono,
            rol: pasajeroUsuario.rol,
          }
        : null,
      precioPorAsiento,
    };
  }

  // Montos efectivos: si el pasaje fue reembolsado, aporta 0 a la caja.
  private montoEfectivoAsientos(p: Pasaje) {
    return p.estadoReembolso === 'REEMBOLSADO'
      ? 0
      : Number(p.montoAsientos || 0);
  }

  private montoEfectivoEncomienda(p: Pasaje) {
    return p.estadoReembolso === 'REEMBOLSADO'
      ? 0
      : Number(p.montoEncomienda || 0);
  }

  private montoEfectivoTotal(p: Pasaje) {
    return p.estadoReembolso === 'REEMBOLSADO'
      ? 0
      : Number(p.montoTotal || 0);
  }

  // =============================================================
  // 3. CAJA CENTRAL
  // Valores calculados desde las ventas reales en PostgreSQL.
  // =============================================================

  async obtenerCaja() {
    const pasajes = await this.pasajeRepo.find();

    const totalBoletos = pasajes.reduce(
      (acc, p) => acc + (p.asientos?.length || 1),
      0,
    );

    const subtotalAsientos = pasajes.reduce(
      (acc, p) => acc + this.montoEfectivoAsientos(p),
      0,
    );

    const subtotalEncomiendas = pasajes.reduce(
      (acc, p) => acc + this.montoEfectivoEncomienda(p),
      0,
    );

    const montoTotalCaja = pasajes.reduce(
      (acc, p) => acc + this.montoEfectivoTotal(p),
      0,
    );

    return {
      totalBoletosEmitidos: totalBoletos,
      totalVentas: pasajes.length,
      subtotalAsientos: Number(subtotalAsientos.toFixed(2)),
      subtotalEncomiendas: Number(subtotalEncomiendas.toFixed(2)),
      montoTotalCaja: Number(montoTotalCaja.toFixed(2)),
    };
  }

  // =============================================================
  // 4. RESEÑAS Y CALIFICACIONES DE UN CHOFER
  // Se relacionan con el vehículo asignado al chofer.
  // =============================================================

  async obtenerResenas(choferId: string) {
    const chofer = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!chofer) {
      throw new NotFoundException('Chofer no encontrado.');
    }

    const vehiculo = chofer.placaAsignada
      ? await this.vehiculoRepo.findOne({
          where: { placa: chofer.placaAsignada },
        })
      : null;

    if (!vehiculo) {
      return {
        chofer: chofer.nombreUsuario,
        placa: null,
        promedio: 0,
        cantidad: 0,
        distribucion: {},
        comentarios: [],
      };
    }

    const reviews = await this.reviewRepo.find({
      where: { vehiculoId: vehiculo.id },
      order: { fechaCreacion: 'DESC' },
    });

    const promedio =
      reviews.length > 0
        ? Number(
            (
              reviews.reduce((acc, r) => acc + r.estrellas, 0) /
              reviews.length
            ).toFixed(2),
          )
        : 0;

    const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      distribucion[r.estrellas] = (distribucion[r.estrellas] || 0) + 1;
    });

    return {
      chofer: chofer.nombreUsuario,
      placa: vehiculo.placa,
      promedio,
      cantidad: reviews.length,
      distribucion,
      comentarios: reviews.map((r) => ({
        id: r.id,
        estrellas: r.estrellas,
        comentario: r.comentario,
        fechaCreacion: r.fechaCreacion,
      })),
    };
  }

  // =============================================================
  // 5. GRÁFICAS DE CALIFICACIONES POR CHOFER
  // Permite filtrar por día / semana / mes con Recharts.
  // =============================================================

  async obtenerGraficas(choferId: string, periodo: string) {
    const chofer = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });

    if (!chofer) {
      throw new NotFoundException('Chofer no encontrado.');
    }

    const vehiculo = chofer.placaAsignada
      ? await this.vehiculoRepo.findOne({
          where: { placa: chofer.placaAsignada },
        })
      : null;

    if (!vehiculo) {
      return {
        chofer: chofer.nombreUsuario,
        placa: null,
        chartData: [],
        promedio: 0,
        cantidad: 0,
        distribucion: {},
      };
    }

    // Rango de fechas según el periodo
    const ahora = new Date();
    let fechaInicio: Date;

    if (periodo === 'dia') {
      fechaInicio = new Date(ahora);
      fechaInicio.setDate(fechaInicio.getDate() - 1);
    } else if (periodo === 'semana') {
      fechaInicio = new Date(ahora);
      fechaInicio.setDate(fechaInicio.getDate() - 7);
    } else {
      // mes (por defecto)
      fechaInicio = new Date(ahora);
      fechaInicio.setMonth(fechaInicio.getMonth() - 1);
    }

    const reviews = await this.reviewRepo.find({
      where: {
        vehiculoId: vehiculo.id,
        fechaCreacion: Between(fechaInicio, ahora),
      },
      order: { fechaCreacion: 'ASC' },
    });

    // Agrupar por día para la evolución de la puntuación
    const porDia = new Map<string, { suma: number; cantidad: number }>();
    reviews.forEach((r) => {
      const fecha = new Date(r.fechaCreacion).toISOString().slice(0, 10);
      const actual = porDia.get(fecha) || { suma: 0, cantidad: 0 };
      actual.suma += r.estrellas;
      actual.cantidad += 1;
      porDia.set(fecha, actual);
    });

    const chartData = Array.from(porDia.entries()).map(([fecha, dato]) => ({
      fecha,
      promedio: Number((dato.suma / dato.cantidad).toFixed(2)),
    }));

    const promedio =
      reviews.length > 0
        ? Number(
            (
              reviews.reduce((acc, r) => acc + r.estrellas, 0) /
              reviews.length
            ).toFixed(2),
          )
        : 0;

    const distribucion: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      distribucion[r.estrellas] = (distribucion[r.estrellas] || 0) + 1;
    });

    return {
      chofer: chofer.nombreUsuario,
      placa: vehiculo.placa,
      chartData,
      promedio,
      cantidad: reviews.length,
      distribucion,
      comentarios: reviews.map((r) => ({
        id: r.id,
        estrellas: r.estrellas,
        comentario: r.comentario,
        fechaCreacion: r.fechaCreacion,
      })),
    };
  }

  // =============================================================
  // 6. CONFIGURACIÓN DEL SINDICATO
  // Fuente de verdad de los precios de pasajes y datos generales.
  // =============================================================

  private async obtenerConfiguracionFila() {
    let cfg = await this.configRepo.findOneBy({ id: 1 });
    if (!cfg) {
      cfg = await this.configRepo.save(
        this.configRepo.create({
          id: 1,
          nombreSindicato: 'Sindicato Mixto Trans Eterazama',
          telefono: '',
          email: '',
          direccion: '',
          precioCochabamba: PRECIOS_INICIALES.cochabamba,
          precioEterazama: PRECIOS_INICIALES.eterazama,
          horarioApertura: '05:00',
          horarioCierre: '22:00',
        }),
      );
    }
    return cfg;
  }

  private serializarConfiguracion(cfg: Configuracion) {
    return {
      id: cfg.id,
      nombreSindicato: cfg.nombreSindicato,
      telefono: cfg.telefono,
      email: cfg.email,
      direccion: cfg.direccion,
      precioCochabamba: Number(cfg.precioCochabamba),
      precioEterazama: Number(cfg.precioEterazama),
      horarioApertura: cfg.horarioApertura,
      horarioCierre: cfg.horarioCierre,
      actualizadoEn: cfg.actualizadoEn,
    };
  }

  async obtenerConfiguracion() {
    const cfg = await this.obtenerConfiguracionFila();
    return this.serializarConfiguracion(cfg);
  }

  async actualizarConfiguracion(
    dto: ActualizarConfiguracionDto,
    actor: ActorAuditoria,
  ) {
    const cfg = await this.obtenerConfiguracionFila();

    const precioCochabamba = Number(dto.precioCochabamba);
    const precioEterazama = Number(dto.precioEterazama);

    if (
      !Number.isFinite(precioCochabamba) ||
      precioCochabamba <= 0 ||
      !Number.isFinite(precioEterazama) ||
      precioEterazama <= 0
    ) {
      throw new BadRequestException(
        'Los precios deben ser números válidos mayores a cero.',
      );
    }

    cfg.precioCochabamba = precioCochabamba;
    cfg.precioEterazama = precioEterazama;

    if (dto.nombreSindicato !== undefined)
      cfg.nombreSindicato = dto.nombreSindicato;
    if (dto.telefono !== undefined) cfg.telefono = dto.telefono;
    if (dto.email !== undefined) cfg.email = dto.email;
    if (dto.direccion !== undefined) cfg.direccion = dto.direccion;
    if (dto.horarioApertura !== undefined)
      cfg.horarioApertura = dto.horarioApertura;
    if (dto.horarioCierre !== undefined)
      cfg.horarioCierre = dto.horarioCierre;

    const guardado = await this.configRepo.save(cfg);

    await this.auditoriaService.registrar(actor, {
      accion: 'actualizar_configuracion',
      modulo: 'configuracion',
      detalle: 'Configuración del sindicato actualizada (precios, contacto y horarios).',
      registroId: String(guardado.id),
      datosNuevos: {
        precioCochabamba: guardado.precioCochabamba,
        precioEterazama: guardado.precioEterazama,
        nombreSindicato: guardado.nombreSindicato,
        telefono: guardado.telefono ?? null,
      },
    });

    return this.serializarConfiguracion(guardado);
  }

  private async obtenerPrecioTramo(tramo: 'cochabamba' | 'eterazama') {
    const cfg = await this.obtenerConfiguracionFila();
    const precio = Number(
      tramo === 'cochabamba' ? cfg.precioCochabamba : cfg.precioEterazama,
    );
    if (!Number.isFinite(precio) || precio <= 0) {
      throw new BadRequestException(
        'La configuración de precios no es válida. Configúrela en Configuración.',
      );
    }
    return precio;
  }

  // Precios oficiales vigentes para la pantalla de venta manual del chofer.
  // Mismos valores que usa el núcleo de venta (no hay precio "de frontend").
  async obtenerPreciosVenta() {
    const cfg = await this.obtenerConfiguracionFila();
    return {
      cochabamba: Number(cfg.precioCochabamba || 0),
      eterazama: Number(cfg.precioEterazama || 0),
    };
  }

  // =============================================================
  // 7. CANCELACIÓN Y REEMBOLSO
  // El usuario solo puede SOLICITAR; la Secretaría confirma y libera.
  // =============================================================

  // Pasajes con solicitud de reembolso (PENDIENTE) o ya reembolsados
  async obtenerReembolsos() {
    const pasajes = await this.pasajeRepo.find({
      where: [
        { estadoReembolso: 'PENDIENTE' },
        { estadoReembolso: 'REEMBOLSADO' },
      ],
      order: { fechaCreacion: 'DESC' },
    });

    // Enriquecer cada pasaje con el estado del viaje de su vehiculo, para que
    // la Secretaria pueda visualizar que un reembolso esta bloqueado EN RUTA.
    const vehiculos = await this.vehiculoRepo.find();
    const porId = new Map(vehiculos.map((v) => [v.id, v]));

    return pasajes.map((p) => {
      const vehiculo = p.vehiculoId ? porId.get(p.vehiculoId) : undefined;
      return {
        ...p,
        vehiculoEstadoViaje: vehiculo?.estadoViaje || null,
        vehiculoEstado: vehiculo?.estadoVehiculo || null,
        puedeReembolsar: vehiculo ? vehiculo.estadoViaje !== 'en_ruta' : true,
      };
    });
  }

  // Confirma el reembolso desde la Central. La marcación del pasaje y la
  // liberación del asiento se ejecutan juntas en una misma transacción.
  async confirmarReembolso(
    pasajeId: string,
    motivo: string,
    secretaria: string,
    actor: ActorAuditoria,
  ) {
    const { guardado: resultado, notificacion } = await this.dataSource.transaction(
      async (manager) => {
        const pasaje = await manager.findOne(Pasaje, {
          where: { id: pasajeId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!pasaje) {
          throw new NotFoundException('Pasaje no encontrado.');
        }

        if (pasaje.estadoReembolso === 'REEMBOLSADO') {
          throw new BadRequestException(
            'Este pasaje ya fue reembolsado. No se puede reembolsar dos veces.',
          );
        }

        // Se permite confirmar un reembolso tanto de una solicitud pendiente
        // (generada por el pasajero) como directamente desde el mapa de
        // asientos de la Boletería de Secretaría. El estado REEMBOLSADO ya
        // quedó bloqueado arriba, garantizando que un pasaje no se reembolse
        // dos veces.

        const montoReembolsado = Number(pasaje.montoTotal || 0);

        // Regla de seguridad: si el vehiculo esta EN RUTA, se rechaza el
        // reembolso sin importar quien lo solicite.
        if (pasaje.vehiculoId) {
          const vehiculoEstado = await manager.findOne(Vehiculo, {
            where: { id: pasaje.vehiculoId },
          });

          if (vehiculoEstado && vehiculoEstado.estadoViaje === 'en_ruta') {
            throw new BadRequestException(
              'El vehículo se encuentra EN RUTA. No es posible realizar un reembolso mientras el vehículo esté en ruta.',
            );
          }
        }

        // Liberar los asientos del vehículo (solo si el pasaje tiene vehículo)
        if (pasaje.vehiculoId) {
          const vehiculo = await manager.findOne(Vehiculo, {
            where: { id: pasaje.vehiculoId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!vehiculo) {
            throw new NotFoundException(
              'Vehículo asociado al pasaje no encontrado.',
            );
          }

          const ocupados = vehiculo.asientosOcupados || [];
          const liberados = ocupados.filter(
            (a) => !(pasaje.asientos || []).includes(a),
          );
          vehiculo.asientosOcupados = liberados;
          await manager.save(Vehiculo, vehiculo);
        }

        pasaje.estadoReembolso = 'REEMBOLSADO';
        pasaje.motivoCancelacion = (motivo || '').trim() || null;
        pasaje.secretariaReembolso = secretaria;
        pasaje.montoReembolsado = montoReembolsado;
        pasaje.fechaReembolso = new Date();
        pasaje.estadoBoleto = 'REEMBOLSADO';

        const guardado = await manager.save(Pasaje, pasaje);

        // Notificación de reembolso confirmado para el pasajero dueño del
        // pasaje, dentro de la MISMA transacción.
        let notificacion: NotificacionPasajero | null = null;
        if (guardado.pasajeroUsuarioId) {
          notificacion = await this.notificacionesService.crearEnTransaccion(
            manager,
            guardado.pasajeroUsuarioId,
            'reembolso',
            'Reembolso confirmado',
            `El reembolso de tu pasaje (${guardado.codigo || ''}) fue confirmado: Bs ${montoReembolsado}.`,
          );
        }

        return { guardado, notificacion };
      },
    );

    await this.auditoriaService.registrar(actor, {
      accion: 'confirmar_reembolso',
      modulo: 'reembolsos',
      detalle: `Reembolso confirmado para el pasaje ${resultado.codigo || pasajeId} por Bs ${resultado.montoReembolsado ?? 0}.`,
      registroId: pasajeId,
      datosAnteriores: {
        estadoReembolso: 'PENDIENTE',
        estadoBoleto: resultado.estadoBoleto,
      },
      datosNuevos: {
        estadoReembolso: 'REEMBOLSADO',
        montoReembolsado: resultado.montoReembolsado,
        secretariaReembolso: resultado.secretariaReembolso,
      },
    });

    this.flotaGateway.notificarCambioFlota();

    // WebSocket post-commit (best-effort).
    if (notificacion) {
      this.notificacionesService.notificarWS(notificacion.usuarioId, notificacion);
    }

    return resultado;
  }

  // =============================================================
  // 8. BOLETERÍA DE SECRETARÍA
  // Info real desde PostgreSQL (vehículos + pasajes).
  // =============================================================

  private resumirVehiculo(v: Vehiculo) {
    const capacidadTotal = Math.max(4, v.capacidadTotal || 12);
    const asientosChofer = v.asientosChofer || [];
    const configuracionPendiente = asientosChofer.length === 0 || !v.configuracionAsientos;
    const config = normalizarConfiguracionAsientos(
      v.configuracionAsientos,
      v.capacidadTotal,
    );
    const vendibles = obtenerAsientosDistribuidos(config).length;
    const ocupados = (v.asientosOcupados || []).filter(
      (a) => a >= 1 && a <= capacidadTotal && !asientosChofer.includes(a),
    );
    return {
      ...v,
      capacidadTotal,
      ocupadosTotal: ocupados.length,
      asientosLibres: Math.max(0, vendibles - asientosChofer.length - ocupados.length),
      asientosChofer,
      configuracionAsientos: config,
      configuracionPendiente,
    };
  }

  // Nómina oficial de choferes: placas asignadas a usuarios activos con rol
  // de chofer. Determina qué vehículos son "oficiales" para Boletería y fila.
  private async placasChoferesOficialesActivos(): Promise<Set<string>> {
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

  // Vehículos registrados en la flota SIN chofer oficial asociado (ningún
  // usuario con rol=chofer tiene esa placa asignada). Solo se informan;
  // nunca se eliminan registros de PostgreSQL.
  async vehiculosSinChoferOficial() {
    const vehiculos = await this.vehiculoRepo.find();
    const choferes = await this.usuarioRepo.find({
      where: { rol: ROLES.CHOFER },
      select: { placaAsignada: true },
    });
    const placasAsignadas = new Set(
      choferes
        .map((c) => c.placaAsignada)
        .filter((p): p is string => !!p),
    );
    const huerfanos = vehiculos.filter((v) => !placasAsignadas.has(v.placa));
    return {
      cantidad: huerfanos.length,
      vehiculos: huerfanos.map((v) => ({
        id: v.id,
        placa: v.placa,
        choferNombre: v.choferNombre,
      })),
    };
  }

  // Paradas principales: Cochabamba y Eterazama con sus vehículos reales
  async obtenerBoleteriaParadas() {
    // Lazy-check: si la cuenta regresiva de un "por salir" ya venció, se
    // transiciona a EN RUTA aquí mismo (además del temporizador de 15 s).
    await this.salidasService.procesarSalidasPendientes();

    const placasOficialesActivas = await this.placasChoferesOficialesActivos();
    const vehiculos = (
      await this.vehiculoRepo.find({
        order: { puestoFila: 'ASC', id: 'ASC' },
      })
    ).filter((v) => placasOficialesActivas.has(v.placa));

    // Posición REAL y ACTUAL (mismo criterio oficial que reindexa PostgreSQL):
    // Boletería nunca debe mostrar un puesto histórico/desplazado.
    const puestosReales = new Map<string, number>();
    for (const parada of ['cochabamba', 'eterazama']) {
      for (const [placa, puesto] of calcularPuestosFila(
        vehiculos,
        parada,
        placasOficialesActivas,
      )) {
        puestosReales.set(placa, puesto);
      }
    }

    const cfg = await this.obtenerConfiguracionFila();

    const pasajes = await this.pasajeRepo.find();
    const pasajesPorVehiculo = new Map<number, any[]>();
    for (const p of pasajes) {
      if (p.vehiculoId == null) continue;
      const lista = pasajesPorVehiculo.get(p.vehiculoId) || [];
      lista.push(p);
      pasajesPorVehiculo.set(p.vehiculoId, lista);
    }

    const conPasajes = (v: Vehiculo) => {
      const resumen = this.resumirVehiculo({
        ...v,
        puestoFila: puestosReales.get(v.placa) ?? v.puestoFila,
      });
      const lista = pasajesPorVehiculo.get(v.id) || [];
      return {
        ...resumen,
        salidaProgramada: v.salidaProgramada,
        pasajes: lista.map((p) => ({
          ...p,
          puedeReembolsar: v.estadoViaje !== 'en_ruta',
        })),
      };
    };

    // Los "por salir" se muestran APARTE con su cuenta regresiva y NO ocupan
    // puesto en la fila (puestoFila = 0): no aparecen aquí.
    return {
      cochabamba: vehiculos
        .filter((v) => v.paradaActual === 'cochabamba' && v.estadoViaje !== 'por_salir')
        .map((v) => conPasajes(v)),
      eterazama: vehiculos
        .filter((v) => v.paradaActual === 'eterazama' && v.estadoViaje !== 'por_salir')
        .map((v) => conPasajes(v)),
      porSalir: vehiculos
        .filter((v) => v.estadoViaje === 'por_salir')
        .map((v) => conPasajes(v)),
      precios: {
        cochabamba: Number(cfg.precioCochabamba),
        eterazama: Number(cfg.precioEterazama),
      },
    };
  }

  // Detalle de un vehículo para la selección de asientos
  async obtenerVehiculoParaBoleteria(id: number) {
    const vehiculo = await this.vehiculoRepo.findOneBy({ id });
    if (!vehiculo) {
      throw new NotFoundException('Vehículo no encontrado.');
    }

    // Regla de oficialidad: solo se vende para vehículos cuyo chofer es
    // un usuario oficial ACTIVO (rol=chofer con la placa asignada).
    const choferOficialActivo = await this.usuarioRepo.findOne({
      where: {
        rol: ROLES.CHOFER,
        estado: 'activo',
        placaAsignada: vehiculo.placa,
      },
    });
    if (!choferOficialActivo) {
      throw new BadRequestException(
        'Este vehículo no tiene un chofer oficial activo y no puede recibir ventas.',
      );
    }

    const pasajes = await this.pasajeRepo.find({
      where: { vehiculoId: id },
      order: { fechaCreacion: 'DESC' },
    });

    return {
      ...this.resumirVehiculo(vehiculo),
      pasajes: pasajes.map((p) => ({
        ...p,
        puedeReembolsar: vehiculo.estadoViaje !== 'en_ruta',
      })),
    };
  }

  // Núcleo único de venta de pasajes (boletería/SECRETARIA y venta manual del
  // CHOFER). La operación se realiza en transacción con lock pesimista sobre
  // el vehículo para validar la disponibilidad de asientos de forma segura
  // incluso si dos vendedores (secretaria, chofer o pasajero) venden el mismo
  // asiento al mismo tiempo. Esta es la ÚNICA lógica de ventas del sistema:
  // precios desde configuración, asientos ocupados/chofer, fila/puesto 1,
  // generación de código y auto-programación de salida.
  private async ejecutarVentaBoleteria(
    dto: VentaBoleteriaDto,
    opciones?: {
      validarPuestoUno?: boolean;
      actor?: ActorAuditoria;
      accionAuditoria?: string;
    },
  ) {
    const precioUnitario = await this.obtenerPrecioTramo(dto.tramo);
    const montoEncomienda = Number(dto.montoEncomienda || 0);
    if (!Number.isFinite(montoEncomienda) || montoEncomienda < 0) {
      throw new BadRequestException(
        'El monto de la encomienda no puede ser negativo.',
      );
    }
    if (montoEncomienda > 5000) {
      throw new BadRequestException(
        'El monto de la encomienda excede el límite permitido (Bs 5000).',
      );
    }

    for (const asiento of dto.asientos) {
      if (!Number.isInteger(asiento) || !Number.isFinite(asiento)) {
        throw new BadRequestException(
          `El valor de asiento "${asiento}" no es válido. Debe ser un número entero positivo.`,
        );
      }
    }

    const asientos = Array.from(new Set(dto.asientos)).sort((a, b) => a - b);

    if (asientos.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos un asiento.');
    }

    if (asientos.length > 50) {
      throw new BadRequestException(
        'No se pueden vender más de 50 asientos en una sola operación.',
      );
    }

    if (asientos.length !== dto.asientos.length) {
      throw new BadRequestException('No se permiten asientos duplicados.');
    }

    if (asientos.length !== dto.pasajeros.length) {
      throw new BadRequestException(
        'Debe registrar el nombre de un pasajero por cada asiento seleccionado.',
      );
    }

    const pasajeroPorAsiento = new Map<number, string>();
    for (const asiento of asientos) {
      const pasajero = dto.pasajeros.find((p) => p.asiento === asiento);
      if (!pasajero || !pasajero.nombre.trim()) {
        throw new BadRequestException(
          `Falta el nombre del pasajero para el asiento ${asiento}.`,
        );
      }
      pasajeroPorAsiento.set(asiento, pasajero.nombre.trim());
    }

    const resultadoVenta = await this.dataSource.transaction(async (manager) => {
      const vehiculo = await manager.findOne(Vehiculo, {
        where: { id: dto.vehiculoId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!vehiculo) {
        throw new NotFoundException('Vehículo no encontrado.');
      }

      // Regla de oficialidad: el vehículo debe pertenecer a un chofer
      // oficial ACTIVO (usuario rol=chofer con esta placa asignada).
      const choferOficialActivo = await manager.findOne(Usuario, {
        where: {
          rol: ROLES.CHOFER,
          estado: 'activo',
          placaAsignada: vehiculo.placa,
        },
      });
      if (!choferOficialActivo) {
        throw new BadRequestException(
          `El vehículo ${vehiculo.placa} no tiene un chofer oficial activo y no puede recibir ventas.`,
        );
      }

      // Estado operativo: un vehículo inactivo, en mantenimiento o en ruta no
      // puede recibir nuevas ventas sin importar lo que envíe el navegador.
      if (vehiculo.estadoVehiculo === 'inactivo') {
        throw new BadRequestException(
          `El vehículo ${vehiculo.placa} está INACTIVO y no puede recibir nuevas ventas.`,
        );
      }
      if (vehiculo.estadoViaje === 'mantenimiento') {
        throw new BadRequestException(
          `El vehículo ${vehiculo.placa} está en MANTENIMIENTO y no puede recibir nuevas ventas.`,
        );
      }
      if (vehiculo.estadoViaje === 'en_ruta') {
        throw new BadRequestException(
          `El vehículo ${vehiculo.placa} está EN RUTA y no puede recibir nuevas ventas.`,
        );
      }

      // Coherencia tramo vs ubicación real del vehículo (regla de negocio del
      // sindicato): un vehículo ubicado en COCHABAMBA solo vende
      // cochabamba→eterazama y uno en ETERAZAMA solo eterazama→cochabamba.
      // El tramo procedente del cliente se descarta si no coincide con la
      // parada/fila real determinada por el backend.
      if (vehiculo.paradaActual !== dto.tramo) {
        throw new BadRequestException(
          `El vehículo ${vehiculo.placa} está ubicado en ${vehiculo.paradaActual === 'cochabamba' ? 'Cochabamba' : 'Eterazama'}, por lo que solo puede vender pasajes desde esa parada. El tramo enviado no coincide con la ubicación real del vehículo.`,
        );
      }

      // Regla de negocio: solo el chofer que ocupa el PUESTO 1 en su parada
      // puede recibir nuevas ventas de pasajes.
      if (vehiculo.paradaActual !== 'cochabamba' && vehiculo.paradaActual !== 'eterazama') {
        throw new BadRequestException(
          'Este vehículo no está anotado en ninguna fila y no puede recibir ventas.',
        );
      }
      if (vehiculo.puestoFila !== 1) {
        throw new BadRequestException(
          `Solo el chofer que ocupa el PUESTO 1 puede cargar pasajeros y recibir nuevas ventas. Este vehículo (${vehiculo.placa}) ocupa el puesto ${vehiculo.puestoFila}.`,
        );
      }

      // Revalidación estricta (SOLO para la venta manual del CHOFER): bajo el
      // lock pesimista del vehículo se RELEE la fila completa de la parada y se
      // recalcula la posición real con la MISMA fuente oficial (calcularPuestosFila).
      // Si el chofer perdió el puesto #1 (o su parada/fila cambió) mientras la
      // pantalla estaba abierta, la venta se rechaza aquí dentro de la transacción.
      if (opciones?.validarPuestoUno) {
        const filaVehiculos = await manager.find(Vehiculo, {
          where: { paradaActual: vehiculo.paradaActual },
          order: { puestoFila: 'ASC', id: 'ASC' },
        });
        const choferesFila = await manager.find(Usuario, {
          where: { rol: ROLES.CHOFER, estado: 'activo' },
          select: { placaAsignada: true },
        });
        const placasOficialesFila = new Set(
          choferesFila
            .map((c) => c.placaAsignada)
            .filter((p): p is string => !!p),
        );
        const puestoBajoLock =
          calcularPuestosFila(
            filaVehiculos,
            vehiculo.paradaActual,
            placasOficialesFila,
          ).get(vehiculo.placa) ?? 0;

        if (puestoBajoLock !== 1) {
          throw new BadRequestException(
            puestoBajoLock > 1
              ? `No puedes vender boletos porque actualmente ocupas el puesto #${puestoBajoLock} de la fila. Solo el primero de la fila puede vender.`
              : 'No puedes vender boletos porque no estás anotado en ninguna fila.',
          );
        }
      }

      // Un vehículo POR SALIR ya no recibe ventas: le queda solo partir.
      if (vehiculo.estadoViaje === 'por_salir') {
        throw new BadRequestException(
          'Este vehículo está POR SALIR y ya no recibe ventas de pasajes.',
        );
      }

      const asientosChofer = vehiculo.asientosChofer || [];
      const ocupados = new Set(vehiculo.asientosOcupados || []);
      const capacidadTotal = Math.max(4, vehiculo.capacidadTotal || 12);

      for (const asiento of asientos) {
        if (asiento < 1 || asiento > capacidadTotal) {
          throw new BadRequestException(
            `El asiento ${asiento} no existe en este vehículo.`,
          );
        }
        if (asientosChofer.includes(asiento)) {
          throw new BadRequestException(
            'Los asientos reservados para el chofer no pueden ser vendidos.',
          );
        }
        if (ocupados.has(asiento)) {
          throw new BadRequestException(
            `El asiento ${asiento} ya no está disponible. Fue vendido por otra boletería.`,
          );
        }
      }

      const montoAsientos = precioUnitario * asientos.length;
      const montoTotal = montoAsientos + montoEncomienda;

      const origen = NOMBRES_PARADAS[dto.tramo];
      const destino =
        dto.tramo === 'cochabamba'
          ? NOMBRES_PARADAS['eterazama']
          : NOMBRES_PARADAS['cochabamba'];

      const pasajeros = asientos.map((asiento) => ({
        asiento,
        nombre: pasajeroPorAsiento.get(asiento)!,
      }));

      const nuevoPasaje = manager.create(Pasaje, {
        pasajeroNombre: dto.contactoRecibo || pasajeros[0].nombre,
        placaVehiculo: vehiculo.placa,
        vehiculoId: vehiculo.id,
        asientos,
        pasajeros,
        montoAsientos,
        montoEncomienda,
        montoTotal,
        tramo: dto.tramo,
        origen,
        destino,
        contactoRecibo: dto.contactoRecibo,
        ciRecibo: dto.ciRecibo || undefined,
        telefonoRecibo: dto.telefonoRecibo || undefined,
        metodoPago: dto.metodoPago || 'EFECTIVO',
      });

      const guardado = await manager.save(Pasaje, nuevoPasaje);

      const codigoBoleto = `ECT-${guardado.id
        .substring(0, 8)
        .toUpperCase()}`;

      guardado.codigo = codigoBoleto;
      guardado.codigoBarras = codigoBoleto;
      guardado.estadoBoleto = 'ACTIVO';
      await manager.save(Pasaje, guardado);

      vehiculo.asientosOcupados = Array.from(
        new Set([...ocupados, ...asientos]),
      );
      await manager.save(Vehiculo, vehiculo);

      // AUTO programación de salida (si esta venta llena el vehículo): en la
      // MISMA transacción de la venta. El chofer del puesto 1 ya no podrá
      // bisar manualmente (el botón queda deshabilitado en el frontend).
      const salida = await this.salidasService.programarSalidaEnTransaccion(
        manager,
        vehiculo.id,
        { manual: false },
      );

      // Auditoría DENTRO de la MISMA transacción: si la venta hace rollback,
      // el movimiento de auditoría también se revierte. Nunca queda una venta
      // confirmada sin su bitácora, y nunca se confía en datos del frontend
      // para la identidad (proviene del JWT vía opciones.actor).
      if (opciones?.actor) {
        const accionAuditoria =
          opciones.accionAuditoria || 'vender_boleteria';
        await this.auditoriaService.registrarEnTransaccion(
          manager,
          opciones.actor as ActorAuditoria,
          {
            accion: accionAuditoria,
            modulo: 'boleteria',
            detalle: `Venta de ${asientos.length} boleto(s) por Bs ${guardado.montoTotal} en el vehículo ${guardado.placaVehiculo || ''} (tramo ${guardado.tramo || ''}).`,
            registroId: guardado.id,
            datosNuevos: {
              codigo: guardado.codigo,
              placaVehiculo: guardado.placaVehiculo,
              asientos: guardado.asientos,
              montoTotal: guardado.montoTotal,
              montoEncomienda: guardado.montoEncomienda ?? 0,
              metodoPago: guardado.metodoPago,
              tramo: guardado.tramo,
            },
          },
        );
      }

      return { guardado, salida };
    });

    return resultadoVenta;
  }

  // Venta de boletería en ventanilla (pago en efectivo), hecha por una
  // SECRETARIA. Reutiliza el núcleo `ejecutarVentaBoleteria`. La auditoría se
  // registra DENTRO de la MISMA transacción (acción vender_boleteria), de modo
  // que una venta confirmada siempre tiene su movimiento en movimientos_secretaria.
  async venderBoleteria(dto: VentaBoleteriaDto, actor: ActorAuditoria) {
    const resultadoVenta = await this.ejecutarVentaBoleteria(dto, {
      actor,
      accionAuditoria: 'vender_boleteria',
    });

    this.flotaGateway.notificarCambioFlota();

    if (resultadoVenta.salida.aplicada) {
      this.salidasService.emitirNotificaciones(resultadoVenta.salida);
    }

    return resultadoVenta.guardado;
  }

  // Venta manual realizada por un CHOFER desde su propio panel, sin QR y solo
  // en efectivo. Reutiliza EXACTAMENTE el mismo núcleo de venta que la boletería
  // (mismos precios, validaciones de fila/puesto 1, asientos ocupados/chofer y
  // disponibilidad). El backend determina TODO desde el JWT y la base de datos:
  //   - vehículo: SIEMPRE el asignado al chofer (jamás del body)
  //   - fila y puesto: con la MISMA fuente oficial (calcularPuestosFila)
  //   - sentido/tramo: derivado de la parada/fila actual (las dos únicas
  //     paradas son filas: cochabamba -> Cbba→Eterazama; eterazama -> Eter→Cbba)
  //   - método de pago: SIEMPRE EFECTIVO
  // El chofer NO puede elegir parada, sentido, fila, vehículo ni precio.
  async ventaManualChofer(
    dto: VentaManualChoferDto,
    actor: ActorAuditoria,
    choferId: string,
  ) {
    if (actor.usuarioId !== choferId) {
      throw new BadRequestException(
        'No autorizado: la venta debe ser registrada con la identidad del chofer.',
      );
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: choferId },
    });
    if (!usuario) {
      throw new NotFoundException('Chofer no encontrado.');
    }
    if (usuario.rol !== ROLES.CHOFER) {
      throw new ForbiddenException('Solo un CHOFER puede usar esta venta.');
    }
    if (usuario.estado !== 'activo') {
      throw new BadRequestException(
        'No puedes vender boletos porque tu estado de servicio está INACTIVO.',
      );
    }
    if (!usuario.placaAsignada) {
      throw new BadRequestException(
        'El chofer no tiene un vehículo asignado; no puede realizar ventas.',
      );
    }

    const vehiculo = await this.vehiculoRepo.findOne({
      where: { placa: usuario.placaAsignada },
    });
    if (!vehiculo) {
      throw new BadRequestException(
        'El vehículo asignado al chofer no está registrado.',
      );
    }

    if (
      vehiculo.estadoVehiculo === 'inactivo' ||
      vehiculo.estadoViaje === 'mantenimiento'
    ) {
      throw new BadRequestException(
        `El vehículo ${vehiculo.placa} está fuera de servicio (${vehiculo.estadoVehiculo === 'inactivo' ? 'inactivo' : 'mantenimiento'}); no puede vender pasajes.`,
      );
    }

    // ============================================================
    // REGLAS ESTRICTAS DE FILA (fuente oficial compartida del proyecto)
    // ============================================================
    // 1) El chofer debe estar ANOTADO en una fila: paradaActual debe ser una de
    //    las dos paradas con fila, y puestoFila > 0.
    // 2) El puesto REAL se calcula con calcularPuestosFila (la MISMA función que
    //    usa obtenerMiFila / reindexarFilaOficial), no confiando en un valor
    //    histórico. Solo el PUESTO #1 puede vender.
    // 3) El sentido de la venta ES la parada actual (sin posibilidad de elegir
    //    otro sentido ni otra fila).
    const parada = vehiculo.paradaActual;
    if (parada !== 'cochabamba' && parada !== 'eterazama') {
      throw new BadRequestException(
        'No puedes vender boletos porque no estás anotado en ninguna fila.',
      );
    }

    if (!(vehiculo.puestoFila > 0)) {
      throw new BadRequestException(
        'No puedes vender boletos porque no estás anotado en ninguna fila.',
      );
    }

    // Cálculo REAL de la posición con la fuente oficial compartida.
    const todosVehiculos = await this.vehiculoRepo.find({
      order: { puestoFila: 'ASC' },
    });
    const choferesOficiales = await this.usuarioRepo.find({
      where: { rol: ROLES.CHOFER, estado: 'activo' },
      select: { placaAsignada: true },
    });
    const placasOficiales = new Set(
      choferesOficiales
        .map((c) => c.placaAsignada)
        .filter((p): p is string => !!p),
    );
    const puestoReal =
      calcularPuestosFila(todosVehiculos, parada, placasOficiales).get(
        vehiculo.placa,
      ) ?? 0;

    if (puestoReal !== 1) {
      throw new BadRequestException(
        `No puedes vender boletos porque actualmente ocupas el puesto #${puestoReal} de la fila. Solo el primero de la fila puede vender.`,
      );
    }

    const tramo = parada; // cochabamba -> Cbba→Eterazama; eterazama -> Eter→Cbba

    // Celular del pasajero: único dato del recibo que aporta el chofer. Se
    // guarda SIEMPRE en formato internacional +591XXXXXXXX (ej: 71234567 ->
    // +59171234567) porque es el mismo número que recibe el recibo por
    // WhatsApp. No se guardan dos formatos distintos.
    const celularInternacional = `+591${dto.celular}`;

    // El backend construye el payload completo bajo su control: el motor de
    // venta únicamente acepta EFECTIVO, recibe el vehiculoId del vehículo
    // asignado en el JWT y el tramo/sentido derivado de la fila actual.
    // Cualquier dato extra del body es rechazado por el ValidationPipe
    // (whitelist + forbidNonWhitelisted).
    const dtoVenta: VentaBoleteriaDto = {
      vehiculoId: vehiculo.id,
      asientos: dto.asientos,
      pasajeros: dto.pasajeros,
      tramo,
      contactoRecibo: dto.pasajeros[0] ? dto.pasajeros[0].nombre : 'Pasajero',
      ciRecibo: undefined,
      telefonoRecibo: celularInternacional,
      montoEncomienda: dto.montoEncomienda ?? undefined,
      metodoPago: 'EFECTIVO',
    };

    // Validación adicional dentro de la MISMA transacción del núcleo (lock
    // pesimista sobre el vehículo): la posición de la fila se RELEE bajo lock,
    // de modo que si entre el cálculo previo y la venta el chofer pierde el
    // puesto #1 la venta se rechaza igual.
    const resultadoVenta = await this.ejecutarVentaBoleteria(dtoVenta, {
      validarPuestoUno: true,
    });

    await this.auditoriaService.registrar(actor, {
      accion: 'venta_manual_chofer',
      modulo: 'ventas',
      detalle: `Venta manual del chofer ${actor.usuarioNombre || ''} (placa ${vehiculo.placa}) de ${dto.asientos.length} boleto(s) por Bs ${resultadoVenta.guardado.montoTotal} en tramo ${resultadoVenta.guardado.tramo || ''} (fila/puesto ${tramo}/#1). Recibo enviado al celular ${celularInternacional}.`,
      registroId: resultadoVenta.guardado.id,
      datosNuevos: {
        pasajeId: resultadoVenta.guardado.id,
        codigo: resultadoVenta.guardado.codigo,
        placaVehiculo: resultadoVenta.guardado.placaVehiculo,
        fila: parada,
        sentido: `${resultadoVenta.guardado.origen} → ${resultadoVenta.guardado.destino}`,
        asientos: resultadoVenta.guardado.asientos,
        montoTotal: resultadoVenta.guardado.montoTotal,
        montoEncomienda: resultadoVenta.guardado.montoEncomienda ?? 0,
        metodoPago: 'EFECTIVO',
        celular: celularInternacional,
        tramo: resultadoVenta.guardado.tramo,
        origen: resultadoVenta.guardado.origen,
        destino: resultadoVenta.guardado.destino,
      },
    });

    this.flotaGateway.notificarCambioFlota();

    if (resultadoVenta.salida.aplicada) {
      this.salidasService.emitirNotificaciones(resultadoVenta.salida);
    }

    return resultadoVenta.guardado;
  }

  // =============================================================
  // 9. SOLICITUDES DE RETIRO VOLUNTARIO DE LA FILA
  // =============================================================
  //
  // La secretaría administra las solicitudes de retiro de los choferes:
  //  - Listar las pendientes.
  //  - Aprobar: si el chofer era el puesto 1 con pasajeros, se transfieren
  //    pasajeros y asientos al nuevo puesto 1 (siguiente de la fila) en una
  //    transacción segura.
  //  - Rechazar: se marca como rechazada y se informa al chofer.

  async listarSolicitudesRetiro(estado?: string) {
    const where: any = {};
    if (estado && ['PENDIENTE', 'ACEPTADA', 'RECHAZADA'].includes(estado)) {
      where.estado = estado;
    }
    return this.solicitudRetiroRepo.find({
      where,
      order: { fechaCreacion: 'DESC' },
    });
  }

  async rechazarRetiro(
    id: string,
    secretariaNombre: string,
    comentario?: string,
    actor?: ActorAuditoria,
  ) {
    const solicitud = await this.solicitudRetiroRepo.findOne({
      where: { id },
    });
    if (!solicitud) {
      throw new NotFoundException('Solicitud de retiro no encontrada.');
    }
    if (solicitud.estado !== 'PENDIENTE') {
      throw new BadRequestException('Esta solicitud ya fue procesada.');
    }

    solicitud.estado = 'RECHAZADA';
    solicitud.procesadoPor = secretariaNombre;
    solicitud.comentarioRespuesta = comentario || null;
    await this.solicitudRetiroRepo.save(solicitud);
    this.flotaGateway.notificarCambioFlota();

    if (actor) {
      await this.auditoriaService.registrar(actor, {
        accion: 'rechazar_retiro',
        modulo: 'retiros',
        detalle: `Solicitud de retiro rechazada de la placa ${solicitud.placa || ''}.`,
        registroId: id,
        datosNuevos: {
          estado: 'RECHAZADA',
          procesadoPor: secretariaNombre,
          comentarioRespuesta: solicitud.comentarioRespuesta ?? null,
        },
      });
    }

    return { solicitud, mensaje: 'Solicitud de retiro rechazada.' };
  }

  // Aprobar la solicitud. Si el chofer tiene pasajeros, los transfiere al
  // siguiente vehículo de la fila (o los deja pendientes de transferir si no
  // hay otro chofer disponible), y luego saca al chofer de la fila.
  async aprobarRetiro(
    id: string,
    secretariaNombre: string,
    comentario?: string,
    actor?: ActorAuditoria,
  ) {
    const solicitud = await this.solicitudRetiroRepo.findOne({
      where: { id },
    });
    if (!solicitud) {
      throw new NotFoundException('Solicitud de retiro no encontrada.');
    }
    if (solicitud.estado !== 'PENDIENTE') {
      throw new BadRequestException('Esta solicitud ya fue procesada.');
    }

    const notificaciones: NotificacionPasajero[] = [];

    const resultado = await this.dataSource.transaction(async (manager) => {
      const vehiculoRepo = manager.getRepository(Vehiculo);
      const pasajeRepo = manager.getRepository(Pasaje);
      const solicitudRepo = manager.getRepository(SolicitudRetiro);

      // Relock la solicitud para evitar procesarla dos veces en paralelo.
      const solucionLock = await solicitudRepo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!solucionLock) {
        throw new NotFoundException('Solicitud de retiro no encontrada.');
      }
      if (solucionLock.estado !== 'PENDIENTE') {
        throw new BadRequestException('Esta solicitud ya fue procesada.');
      }

      const vehiculo = await vehiculoRepo.findOne({
        where: { id: solucionLock.vehiculoId || 0 },
        lock: { mode: 'pessimistic_write' },
      });

      if (!vehiculo) {
        throw new BadRequestException(
          'El vehículo asociado a la solicitud ya no existe.',
        );
      }

      const parada = vehiculo.paradaActual;
      let transferidoA: string | null = null;
      let pendientesTransferir = 0;

      // Determinar si el chofer saliente es el puesto 1 y tiene pasajeros
      const esPuesto1 = vehiculo.puestoFila === 1;
      const ocupados = Array.from(
        new Set((vehiculo.asientosOcupados || []).map(Number)),
      ).filter((n) => Number.isInteger(n) && n >= 1).sort((a, b) => a - b);

      if (esPuesto1 && ocupados.length > 0) {
        // Buscar el siguiente chofer de la fila (puesto 2 y siguientes) que
        // esté activo y no en ruta.
        const fila = await vehiculoRepo.find({
          where: { paradaActual: parada },
          order: { puestoFila: 'ASC', id: 'ASC' },
        });
        const siguiente = fila.find(
          (v) =>
            v.id !== vehiculo.id &&
            v.puestoFila > 1 &&
            v.estadoVehiculo === 'activo' &&
            v.estadoViaje !== 'por_salir' &&
            v.estadoViaje !== 'en_ruta' &&
            v.estadoViaje !== 'mantenimiento',
        );

        if (siguiente) {
          // Asientos libres reales del siguiente chofer (excluye sus asientos
          // de chofer y los ya ocupados). La asignación se hace sin colisiones:
          // cada asiento transferido se toma de la lista de libres una sola vez.
          const choferSiguiente = new Set(siguiente.asientosChofer || []);
          const ocupadosSiguiente = new Set(siguiente.asientosOcupados || []);
          const libres: number[] = [];
          for (let a = 1; a <= (siguiente.capacidadTotal || 12); a++) {
            if (!choferSiguiente.has(a) && !ocupadosSiguiente.has(a)) {
              libres.push(a);
            }
          }

          const pasajes = await pasajeRepo.find({
            where: { placaVehiculo: vehiculo.placa },
            order: { fechaCreacion: 'ASC' },
          });

          let transferidos = 0;
          const mapaAsientos = new Map<number, number>(); // asiento original -> nuevo

          for (const pasaje of pasajes) {
            if (pasaje.estadoBoleto === 'UTILIZADO' || pasaje.fechaEscaneo) continue;
            if (pasaje.estadoReembolso === 'REEMBOLSADO') continue;

            const asientosOriginales = (pasaje.asientos || [])
              .map(Number)
              .filter((a) => Number.isInteger(a) && a >= 1);
            if (asientosOriginales.length === 0) continue;

            // Un pasaje solo se transfiere si TODOS sus asientos tienen cupo en
            // el siguiente vehículo; así nunca se divide ni se pisa otro asiento.
            const nuevos: number[] = [];
            const reservadosLocal: { orig: number; libre: number }[] = [];
            let cabeCompleto = true;

            for (const asiento of asientosOriginales) {
              const yaAsignado = mapaAsientos.get(asiento);
              if (yaAsignado != null) {
                nuevos.push(yaAsignado);
                continue;
              }
              const libre = libres.shift();
              if (libre == null) {
                cabeCompleto = false;
                break;
              }
              mapaAsientos.set(asiento, libre);
              reservadosLocal.push({ orig: asiento, libre });
              nuevos.push(libre);
            }

            if (!cabeCompleto) {
              // Revertir SOLO las reservas de este pasaje (las de pasajes
              // anteriores no se tocan).
              for (const r of reservadosLocal) {
                libres.unshift(r.libre);
                mapaAsientos.delete(r.orig);
              }
              continue;
            }

            pasaje.placaVehiculo = siguiente.placa;
            pasaje.vehiculoId = siguiente.id;
            pasaje.asientos = nuevos;
            if (Array.isArray(pasaje.pasajeros)) {
              pasaje.pasajeros = pasaje.pasajeros.map((pj: any, idx: number) => ({
                ...pj,
                asiento: nuevos[idx] ?? pj.asiento,
              }));
            }
            await pasajeRepo.save(pasaje);
            transferidos += asientosOriginales.length;

            // Notificación de transferencia para los pasajeros con cuenta
            // vinculada, dentro de la MISMA transacción.
            if (pasaje.pasajeroUsuarioId) {
              const noti = await this.notificacionesService.crearEnTransaccion(
                manager,
                pasaje.pasajeroUsuarioId,
                'transferencia',
                'Pasaje transferido',
                `Tu pasaje fue transferido al vehículo ${siguiente.placa}. Nuevos asientos: ${nuevos.join(', ')}.`,
              );
              notificaciones.push(noti);
            }
          }

          // Actualizar asientos ocupados del vehículo que recibe
          const siguientesOcupados = Array.from(
            new Set([
              ...(siguiente.asientosOcupados || []),
              ...Array.from(mapaAsientos.values()),
            ]),
          );
          siguiente.asientosOcupados = siguientesOcupados;
          await vehiculoRepo.save(siguiente);

          transferidoA = siguiente.placa;
          pendientesTransferir = ocupados.length - transferidos;
        } else {
          // No hay siguiente chofer: quedan pendientes de transferir
          pendientesTransferir = ocupados.length;
        }
      }

      // Sacar al chofer saliente de la fila
      vehiculo.paradaActual = 'fuera_de_fila';
      vehiculo.puestoFila = 0;
      vehiculo.horaIngresoFila = null;
      vehiculo.asientosOcupados = [];
      vehiculo.estadoViaje = 'listo';
      vehiculo.salidaProgramada = null;
      await vehiculoRepo.save(vehiculo);

      // Reindexar la fila de forma OFICIAL: los puestos siguientes suben y solo
      // los vehículos con chofer oficial (no por salir / en ruta) ocupan puesto.
      const placasOficiales = await this.placasChoferesOficialesActivos();
      await reindexarFilaOficial(vehiculoRepo, parada, placasOficiales);

      // Marcar la solicitud como ACEPTADA dentro de la MISMA transacción: si
      // algo falla antes, se revierte todo (solicitud y transferencia incluidas).
      solucionLock.estado = 'ACEPTADA';
      solucionLock.procesadoPor = secretariaNombre;
      solucionLock.comentarioRespuesta = comentario || null;
      await solicitudRepo.save(solucionLock);

      return { transferidoA, pendientesTransferir };
    });

    this.flotaGateway.notificarCambioFlota();

    // WebSocket post-commit (best-effort) para cada pasajero transferido.
    for (const n of notificaciones) {
      this.notificacionesService.notificarWS(n.usuarioId, n);
    }

    if (actor) {
      await this.auditoriaService.registrar(actor, {
        accion: 'aprobar_retiro',
        modulo: 'retiros',
        detalle: `Solicitud de retiro aprobada para la placa ${resultado.transferidoA ? `(transferidos a ${resultado.transferidoA})` : ''}.`,
        registroId: id,
        datosNuevos: {
          estado: 'ACEPTADA',
          procesadoPor: secretariaNombre,
          transferidoA: resultado.transferidoA,
          pendientesTransferir: resultado.pendientesTransferir,
        },
      });
    }

    return {
      solicitud: await this.solicitudRetiroRepo.findOne({ where: { id } }),
      transferidoA: resultado.transferidoA,
      pendientesTransferir: resultado.pendientesTransferir,
      mensaje:
        resultado.transferidoA
          ? `Retiro aprobado. Los pasajeros y asientos se transfirieron al vehículo ${resultado.transferidoA}.`
          : resultado.pendientesTransferir > 0
            ? 'Retiro aprobado. No hay otro chofer en la fila; los pasajeros quedaron sin asignar y deberán reasignarse manualmente.'
            : 'Retiro aprobado correctamente.',
    };
  }
}
