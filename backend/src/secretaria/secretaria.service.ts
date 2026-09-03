import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';

import { Usuario } from '../auth/usuario.entity';
import { ROLES } from '../auth/roles';
import { Vehiculo } from '../flota/vehiculo.entity';
import { Pasaje } from '../pasajes/pasaje.entity';
import { Review } from '../reviews/review.entity';
import { Viaje } from '../chofer/entities/viaje.entity';
import { FlotaGateway } from '../flota/flota.gateway';
import { Configuracion } from './entities/configuracion.entity';
import { VentaBoleteriaDto } from './dto/vender-boleteria.dto';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto';

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

    private readonly dataSource: DataSource,

    private readonly flotaGateway: FlotaGateway,
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

  async actualizarConfiguracion(dto: ActualizarConfiguracionDto) {
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
  ) {
    const resultado = await this.dataSource.transaction(
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

        return manager.save(Pasaje, pasaje);
      },
    );

    this.flotaGateway.notificarCambioFlota();

    return resultado;
  }

  // =============================================================
  // 8. BOLETERÍA DE SECRETARÍA
  // Info real desde PostgreSQL (vehículos + pasajes).
  // =============================================================

  private resumirVehiculo(v: Vehiculo) {
    const capacidadTotal = Math.max(4, v.capacidadTotal || 12);
    const ocupados = (v.asientosOcupados || []).filter(
      (a) => a >= 3 && a <= capacidadTotal,
    );
    return {
      ...v,
      capacidadTotal,
      ocupadosTotal: ocupados.length,
      asientosLibres: Math.max(0, capacidadTotal - 2 - ocupados.length),
      asientosChofer: [1, 2],
    };
  }

  // Paradas principales: Cochabamba y Eterazama con sus vehículos reales
  async obtenerBoleteriaParadas() {
    const vehiculos = await this.vehiculoRepo.find({
      order: { puestoFila: 'ASC', id: 'ASC' },
    });

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
      const resumen = this.resumirVehiculo(v);
      const lista = pasajesPorVehiculo.get(v.id) || [];
      return {
        ...resumen,
        pasajes: lista.map((p) => ({
          ...p,
          puedeReembolsar: v.estadoViaje !== 'en_ruta',
        })),
      };
    };

    return {
      cochabamba: vehiculos
        .filter((v) => v.paradaActual === 'cochabamba')
        .map((v) => conPasajes(v)),
      eterazama: vehiculos
        .filter((v) => v.paradaActual === 'eterazama')
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

  // Venta de boletería en ventanilla (pago en efectivo).
  // La operación se realiza en transacción con lock pesimista sobre el
  // vehículo para validar la disponibilidad de asientos de forma segura
  // incluso si dos secretarias venden el mismo asiento al mismo tiempo.
  async venderBoleteria(dto: VentaBoleteriaDto) {
    const precioUnitario = await this.obtenerPrecioTramo(dto.tramo);
    const montoEncomienda = Number(dto.montoEncomienda || 0);

    const asientos = Array.from(new Set(dto.asientos)).sort((a, b) => a - b);

    if (asientos.length === 0) {
      throw new BadRequestException('Debe seleccionar al menos un asiento.');
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

    const pasajeGuardado = await this.dataSource.transaction(async (manager) => {
      const vehiculo = await manager.findOne(Vehiculo, {
        where: { id: dto.vehiculoId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!vehiculo) {
        throw new NotFoundException('Vehículo no encontrado.');
      }

      const ocupados = new Set(vehiculo.asientosOcupados || []);
      const capacidadTotal = Math.max(4, vehiculo.capacidadTotal || 12);

      for (const asiento of asientos) {
        if (asiento < 1 || asiento > capacidadTotal) {
          throw new BadRequestException(
            `El asiento ${asiento} no existe en este vehículo.`,
          );
        }
        if (asiento <= 2) {
          throw new BadRequestException(
            'Los asientos del chofer no pueden ser vendidos.',
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

      return guardado;
    });

    this.flotaGateway.notificarCambioFlota();

    return pasajeGuardado;
  }
}
