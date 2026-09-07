import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Vehiculo } from './vehiculo.entity';
import { TipoVehiculo } from './tipo-vehiculo.entity';
import { Viaje } from '../chofer/entities/viaje.entity';
import { Usuario } from '../auth/usuario.entity';
import { ROLES } from '../auth/roles';
import { FlotaGateway } from './flota.gateway';
import {
  normalizarConfiguracionAsientos,
  generarConfiguracionPorDefecto,
  obtenerAsientosDistribuidos,
} from './asientos-config.util';
import {
  reindexarFilaOficial,
  obtenerSiguientePuesto,
  calcularPuestosFila,
} from './fila.util';

@Injectable()
export class FlotaService {
  constructor(
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,

    @InjectRepository(TipoVehiculo)
    private readonly tipoVehiculoRepo: Repository<TipoVehiculo>,

    @InjectRepository(Viaje)
    private readonly viajeRepo: Repository<Viaje>,

    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,

    private readonly flotaGateway: FlotaGateway,
  ) {}

  // La fuente de verdad del estado es el vehiculo en la base de datos, junto
  // con el estado de servicio del chofer (usuario.estado). Secretaría debe ver
  // el MISMO estado que el chofer: por eso se incluyen TODOS los choferes
  // oficiales (activos e inactivos) y se expone estadoServicio para que la UI
  // los categorice (un chofer inactivo = FUERA DE SERVICIO).
  async obtenerTodos() {
    const placasOficiales = await this.placasChoferesOficiales();
    const placasOficialesActivas = await this.placasChoferesOficialesActivos();
    const estadoServicioPorPlaca = await this.estadoServicioPorPlaca();
    const vehiculos = (
      await this.vehiculoRepo.find({
        order: { id: 'DESC' },
      })
    ).filter((v) => placasOficiales.has(v.placa));

    const viajes = await this.viajeRepo.find();

    // Posición REAL y ACTUAL de cada vehículo en su fila, calculada con el
    // MISMO criterio oficial que reindexa PostgreSQL (fuente de verdad): solo
    // choferes oficiales activos y sin por_salir/en_ruta/mantenimiento. Así la
    // lista nunca expone un puesto histórico o desplazado.
    const puestosRealesDeFila = new Map<string, number>();
    for (const parada of ['cochabamba', 'eterazama']) {
      for (const [placa, puesto] of calcularPuestosFila(
        vehiculos,
        parada,
        placasOficialesActivas,
      )) {
        puestosRealesDeFila.set(placa, puesto);
      }
    }

    // Viaje actualmente OPERATIVO por placa (programado o en ruta). Un viaje
    // finalizado es histórico: sus pasajerosTransportados NO son pasajeros
    // actuales del vehículo.
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

    return vehiculos.map((v) => {
      const viajeActual = viajeActivoPorPlaca.get(v.placa) || null;

      const chofer = v.asientosChofer || [];
      const config = normalizarConfiguracionAsientos(
        v.configuracionAsientos,
        v.capacidadTotal,
      );
      const configuracionPendiente = chofer.length === 0 || !v.configuracionAsientos;
      const vendibles = obtenerAsientosDistribuidos(config).length;
      const ocupados = (v.asientosOcupados || []).filter(
        (a) => !chofer.includes(a),
      ).length;
      const asientosLibres = Math.max(vendibles - chofer.length - ocupados, 0);

      return {
        ...v,
        estadoServicio: estadoServicioPorPlaca.get(v.placa) || 'inactivo',
        // Un chofer NO activo jamás ocupa puesto: su fila es 0 siempre.
        puestoFila:
          estadoServicioPorPlaca.get(v.placa) === 'activo'
            ? (puestosRealesDeFila.get(v.placa) ?? v.puestoFila)
            : 0,
        asientosChofer: chofer,
        configuracionAsientos: config,
        configuracionPendiente,
        pasajeros: this.pasajerosActuales(v, ocupados),
        asientosLibres,
        viajeActual: viajeActual && (viajeActual.estado === 'en_ruta' || viajeActual.estado === 'programado')
          ? {
              origen: viajeActual.origen,
              destino: viajeActual.destino,
              horaSalida: viajeActual.horaSalida,
              estadoViaje: viajeActual.estado,
            }
          : null,
      };
    });
  }

  // Mapa placa -> estado de servicio del chofer (usuario.estado), la única
  // fuente de verdad de ACTIVO/INACTIVO.
  private async estadoServicioPorPlaca(): Promise<Map<string, string>> {
    const choferes = await this.usuarioRepo.find({
      where: { rol: ROLES.CHOFER },
      select: { placaAsignada: true, estado: true },
    });
    const mapa = new Map<string, string>();
    for (const c of choferes) {
      if (c.placaAsignada) mapa.set(c.placaAsignada, c.estado);
    }
    return mapa;
  }

  // PASAJEROS ACTUALES: personas con una venta/pasaje activo en el viaje
  // operativo del vehículo.
  //
  // FUENTE ÚNICA DE VERDAD: un vehículo solo tiene pasajeros actuales si:
  //   1. Está EN RUTA (paradaActual = 'fuera_de_fila' y estadoViaje = 'en_ruta')
  //   2. Está en fila Y es el puesto 1 (recibiendo ventas)
  //
  // En CUALQUIER OTRO caso (fuera_de_fila sin en_ruta, mantenimiento, inactivo,
  // en fila pero NO puesto 1), los pasajeros actuales son 0.
  // Los pasajes/pasajeros de viajes anteriores son HISTÓRICOS y permanecen
  // en PostgreSQL sin borrar, pero NO cuentan como pasajeros actuales.
  private pasajerosActuales(v: Vehiculo, ocupados: number): number {
    if (v.estadoVehiculo === 'inactivo') return 0;
    if (v.estadoViaje === 'mantenimiento') return 0;
    // Fuera de fila sin viaje activo: sin pasajeros actuales
    if (v.paradaActual === 'fuera_de_fila' && v.estadoViaje !== 'en_ruta') {
      return 0;
    }
    // En fila pero NO es el puesto 1: no está recibiendo pasajeros
    if (
      (v.paradaActual === 'cochabamba' || v.paradaActual === 'eterazama') &&
      v.puestoFila !== 1
    ) {
      return 0;
    }
    // Por salir: la venta ya cerró, estos son pasajeros del viaje que parte
    // pero se muestran como "pasajeros del viaje", no como "actuales"
    if (v.estadoViaje === 'por_salir') {
      return 0;
    }
    return ocupados;
  }

  // Placas de choferes OFICIALES ACTIVOS (usuario rol=chofer con vehículo
  // asignado). La Nómina de Secretaría es la fuente oficial de choferes.
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

  // Placas de todos los choferes OFICIALES (activos E inactivos). Se usa para
  // que Secretaría vea también los inactivos (FUERA DE SERVICIO), sin incluir
  // vehículos huérfanos sin chofer oficial asociado.
  private async placasChoferesOficiales(): Promise<Set<string>> {
    const choferes = await this.usuarioRepo.find({
      where: { rol: ROLES.CHOFER },
      select: { placaAsignada: true },
    });
    return new Set(
      choferes
        .map((c) => c.placaAsignada)
        .filter((p): p is string => !!p),
    );
  }

  async obtenerPorId(id: number) {
    const vehiculo = await this.vehiculoRepo.findOneBy({ id });
    if (!vehiculo) throw new NotFoundException('Vehículo no encontrado');
    return vehiculo;
  }

  obtenerPorParada(parada: string) {
    return this.vehiculoRepo.find({
      where: { paradaActual: parada },
      order: { puestoFila: 'ASC' },
    });
  }

  async buscarPorPlaca(placa: string) {
    return this.vehiculoRepo.findOne({
      where: { placa },
    });
  }

  async crearVehiculo(data: {
    choferNombre: string;
    choferCi?: string;
    qrImagenUrl?: string;
    tipoVehiculo: string;
    color: string;
    placa: string;
    paradaActual?: string;
    puestoFila?: number;
    capacidadTotal: number;
    filas?: (number | null)[][];
    asientosChofer?: number[];
  }, manager?: EntityManager) {
    const vehiculoRepo = manager ? manager.getRepository(Vehiculo) : this.vehiculoRepo;
    const capacidadTotal = Math.floor(data.capacidadTotal);
    if (capacidadTotal < 4) {
      throw new BadRequestException(
        'La capacidad mínima debe ser de 4 asientos (2 del chofer + 2 de pasajeros).',
      );
    }
    const vehiculo = this.vehiculoRepo.create({
      choferNombre: data.choferNombre,
      choferCi: data.choferCi,
      qrImagenUrl: data.qrImagenUrl,
      tipoVehiculo: data.tipoVehiculo,
      color: data.color,
      placa: data.placa,
      paradaActual: data.paradaActual || 'fuera_de_fila',
      puestoFila: data.puestoFila || 0,
      capacidadTotal,
      asientosChofer: [],
      configuracionAsientos: null,
    });

    // Si Secretaría ya definió la distribución final, se valida y se usa en
    // lugar de la distribución inicial automática. Así la distribución real del
    // vehículo es EXACTAMENTE la configurada en el diseñador.
    if (Array.isArray(data.filas) && data.filas.length > 0) {
      const configValidada = this.validarYNormalizarConfig(
        vehiculo,
        data.filas,
        data.asientosChofer && data.asientosChofer.length > 0
          ? data.asientosChofer
          : [],
      );
      vehiculo.asientosChofer = configValidada.chofer;
      vehiculo.configuracionAsientos = {
        ancho: configValidada.ancho,
        filas: configValidada.filas,
      };
    }

    const paradaInicial = data.paradaActual || 'fuera_de_fila';
    const esFilaInicial =
      paradaInicial === 'cochabamba' || paradaInicial === 'eterazama';

    // Creación directa sobre una parada de fila: se persiste DENTRO del
    // mecanismo oficial de fila (advisory lock + reindex consecutivo) para que
    // el puesto del vehículo NUNCA quede desplazado respecto a la fila real.
    const guardado =
      esFilaInicial && !manager
        ? await this.vehiculoRepo.manager.transaction(async (m) => {
            const repo = m.getRepository(Vehiculo);
            const lockKey =
              paradaInicial === 'cochabamba' ? 771001 : 771002;
            await m.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);
            const g = await repo.save(vehiculo);
            const placasOficiales =
              await this.placasChoferesOficialesActivos();
            await reindexarFilaOficial(repo, paradaInicial, placasOficiales);
            return g;
          })
        : await vehiculoRepo.save(vehiculo);

    if (!manager) {
      this.flotaGateway.notificarCambioFlota();
    }
    return guardado;
  }

  // =============================================
  // TIPOS / MODELOS DE VEHÍCULO
  // =============================================

  async obtenerTiposVehiculo() {
    return this.tipoVehiculoRepo.find({
      order: { nombre: 'ASC' },
    });
  }

  async buscarTipoVehiculoPorNombre(nombre: string) {
    const nombreLimpio = nombre.trim().toLowerCase();
    const lista = await this.tipoVehiculoRepo.find();
    return (
      lista.find((t) => t.nombre.trim().toLowerCase() === nombreLimpio) || null
    );
  }

  async crearTipoVehiculo(nombre: string) {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      throw new BadRequestException('El nombre del tipo de vehículo es obligatorio.');
    }
    const existente = await this.buscarTipoVehiculoPorNombre(nombreLimpio);
    if (existente) {
      throw new BadRequestException(
        `El tipo de vehículo "${existente.nombre}" ya está registrado.`,
      );
    }
    const tipo = this.tipoVehiculoRepo.create({ nombre: nombreLimpio });
    const guardado = await this.tipoVehiculoRepo.save(tipo);
    this.flotaGateway.notificarCambioFlota();
    return guardado;
  }

  async eliminarTipoVehiculo(id: number) {
    const res = await this.tipoVehiculoRepo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Tipo de vehículo no encontrado');
    this.flotaGateway.notificarCambioFlota();
    return { status: 'Tipo de vehículo eliminado correctamente' };
  }

  // =============================================
  // CONFIGURACIÓN DINÁMICA DE ASIENTOS
  // =============================================

  async configurarAsientos(
    id: number,
    filas: (number | null)[][],
    asientosChofer: number[],
  ) {
    const vehiculo = await this.obtenerPorId(id);
    const { ancho, filas: filasNorm, chofer } = this.validarYNormalizarConfig(
      vehiculo,
      filas,
      asientosChofer,
    );
    vehiculo.asientosChofer = chofer;
    vehiculo.configuracionAsientos = { ancho, filas: filasNorm };
    const guardado = await this.vehiculoRepo.save(vehiculo);
    this.flotaGateway.notificarCambioFlota();
    return guardado;
  }

  // Valida y normaliza una distribución de asientos para un vehículo.
  // Reutilizado por configurarAsientos y por la creación de vehículos con una
  // distribución final definida por Secretaría. No genera la distribución: la
  // valida tal como se recibió.
  private validarYNormalizarConfig(
    vehiculo: Vehiculo,
    filas: (number | null)[][],
    asientosChofer: number[],
  ): { ancho: number; filas: (number | null)[][]; chofer: number[] } {
    if (!Array.isArray(filas) || filas.length === 0) {
      throw new BadRequestException('La configuración debe contener al menos una fila.');
    }

    // Aplanar solo celdas numéricas (los null son espacios vacíos, no vendibles).
    const numeros = filas.flat().filter((c): c is number => typeof c === 'number');
    const unicos = new Set(numeros);
    if (unicos.size !== numeros.length) {
      throw new BadRequestException('No se permiten números de asiento duplicados en la configuración.');
    }

    // Todo número debe estar dentro del rango válido y la cantidad de asientos
    // vendibles (numerados) no debe exceder la capacidad del vehículo.
    for (const n of numeros) {
      if (!Number.isInteger(n) || n < 1 || n > vehiculo.capacidadTotal) {
        throw new BadRequestException(
          `El número de asiento ${n} no es válido. Use números del 1 al ${vehiculo.capacidadTotal}.`,
        );
      }
    }

    // Debe quedar al menos 1 asiento vendible (pasajero) tras reservar chofer.
    if (numeros.length === asientosChofer.length && numeros.length > 0) {
      throw new BadRequestException('Debe quedar al menos 1 asiento para pasajeros.');
    }

    // Validar asientos del chofer: deben ser parte de la configuración y la
    // cantidad de asientos libres para pasajeros debe ser al menos 1.
    const choferUnicos = Array.from(new Set(asientosChofer));
    if (choferUnicos.length < 1 || choferUnicos.length > vehiculo.capacidadTotal - 1) {
      throw new BadRequestException(
        'Debe reservar al menos 1 asiento para el chofer y dejar al menos 1 asiento para pasajeros.',
      );
    }
    for (const s of choferUnicos) {
      if (!unicos.has(s)) {
        throw new BadRequestException(`El asiento del chofer ${s} no existe en la configuración.`);
      }
      if (unicos.has(s) && asientosChofer.filter((x) => x === s).length > 1) {
        throw new BadRequestException(`El asiento del chofer ${s} está duplicado.`);
      }
    }

    // Los asientos del chofer no deben estar vendidos a pasajeros.
    const ocupados = new Set(vehiculo.asientosOcupados || []);
    for (const s of choferUnicos) {
      if (ocupados.has(s)) {
        throw new BadRequestException(
          `El asiento ${s} no puede asignarse al chofer porque ya está vendido a un pasajero.`,
        );
      }
    }

    // Regla anti-pérdida de ventas: un asiento con venta activa no puede
    // convertirse en espacio vacío (eliminarse de la configuración).
    for (const s of ocupados) {
      if (!unicos.has(s)) {
        throw new BadRequestException(
          `El asiento ${s} tiene una venta activa y no puede eliminarse de la configuración.`,
        );
      }
      if (choferUnicos.includes(s)) {
        throw new BadRequestException(
          `El asiento ${s} tiene una venta activa y no puede asignarse al chofer.`,
        );
      }
    }

    // Corregir simetría de filas rellenando con espacios vacíos hasta el ancho.
    const ancho = Math.max(...filas.map((f) => f.length), 0);
    const filasNorm = filas.map((fila) => {
      const fill = [...fila];
      while (fill.length < ancho) fill.push(null);
      return fill;
    });

    return { ancho, filas: filasNorm, chofer: choferUnicos.sort((a, b) => a - b) };
  }

  // Devuelve los asientos del chofer de un vehículo (sin fallback).
  // Si el vehículo no tiene configuración, devuelve [].
  obtenerAsientosChofer(vehiculo: Vehiculo): number[] {
    return vehiculo.asientosChofer || [];
  }

  // Notifica a todos los clientes conectados (Boletería, Chofer, Pasajero)
  // que la flota cambió. Se usa desde operaciones transaccionales de otros
  // módulos que ya persisten con su propio EntityManager.
  notificarFlota(): void {
    this.flotaGateway.notificarCambioFlota();
  }

  async trasladarVehiculo(id: number, nuevaParada: string) {
    const vehiculoOrigen = await this.obtenerPorId(id);
    const paradaOrigen = vehiculoOrigen.paradaActual;

    // Operación transaccional con el criterio OFICIAL: al llegar a una fila el
    // vehículo ocupa el SIGUIENTE puesto real (sin huecos y al final), y tanto
    // la parada que deja como la que recibe se reindexan de forma consecutiva.
    const guardado = await this.vehiculoRepo.manager.transaction(
      async (manager) => {
        const vehiculoRepo = manager.getRepository(Vehiculo);
        const vehiculo = await vehiculoRepo.findOneBy({ id });
        if (!vehiculo) {
          throw new NotFoundException('Vehículo no encontrado');
        }

        const placasOficiales = await this.placasChoferesOficialesActivos();
        const nuevaEsFila =
          nuevaParada === 'cochabamba' || nuevaParada === 'eterazama';
        const origenEsFila =
          paradaOrigen === 'cochabamba' || paradaOrigen === 'eterazama';

        if (nuevaEsFila && paradaOrigen !== nuevaParada) {
          // Llegada al final de la fila: siguiente puesto oficial disponible.
          vehiculo.puestoFila = await obtenerSiguientePuesto(
            vehiculoRepo,
            nuevaParada,
            placasOficiales,
          );
          vehiculo.horaIngresoFila = new Date();
        } else if (!nuevaEsFila) {
          vehiculo.puestoFila = 0;
          if (nuevaParada === 'fuera_de_fila') {
            vehiculo.horaIngresoFila = null;
          }
        }

        vehiculo.paradaActual = nuevaParada;
        if (nuevaParada === 'en_ruta') {
          vehiculo.asientosOcupados = [];
        }
        if (nuevaParada === 'fuera_de_fila') {
          // Al mover a fuera_de_fila (Fuera de servicio) se limpian los
          // asientos de pasajeros del viaje previo. El historial de
          // boletos/pasajes/viajes permanece intacto en PostgreSQL.
          vehiculo.asientosOcupados = [];
        }

        await vehiculoRepo.save(vehiculo);

        // Reindexar las filas afectadas (origen y destino) de forma oficial.
        if (origenEsFila) {
          await reindexarFilaOficial(vehiculoRepo, paradaOrigen, placasOficiales);
        }
        if (nuevaEsFila && paradaOrigen !== nuevaParada) {
          await reindexarFilaOficial(vehiculoRepo, nuevaParada, placasOficiales);
        }

        return vehiculo;
      },
    );

    this.flotaGateway.notificarCambioFlota();
    return guardado;
  }

  async cambiarEstadoParada(id: number, nuevaParada: string) {
    return this.trasladarVehiculo(id, nuevaParada);
  }

  async reordenarFila(cambios: { id: number; puestoFila: number }[]) {
    // Operación atómica: los puestos se guardan y luego la fila se reindexa
    // con el criterio OFICIAL (solo choferes activos ocupan puesto; los
    // puestos quedan consecutivos SIN huecos).
    await this.vehiculoRepo.manager.transaction(async (manager) => {
      const vehiculoRepo = manager.getRepository(Vehiculo);
      for (const cambio of cambios) {
        await manager.update(Vehiculo, cambio.id, {
          puestoFila: cambio.puestoFila,
        });
      }

      if (cambios.length > 0) {
        const primero = await vehiculoRepo.findOne({
          where: { id: cambios[0].id },
        });
        if (primero) {
          const placasOficiales = await this.placasChoferesOficialesActivos();
          await reindexarFilaOficial(
            vehiculoRepo,
            primero.paradaActual,
            placasOficiales,
          );
        }
      }
    });
    this.flotaGateway.notificarCambioFlota();
    return { status: 'Fila reordenada exitosamente' };
  }

  async eliminarVehiculo(id: number) {
    const res = await this.vehiculoRepo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Vehículo no encontrado');
    this.flotaGateway.notificarCambioFlota();
    return { status: 'Vehículo eliminado correctamente' };
  }

  async actualizarVehiculo(
    id: number,
    data: {
      choferNombre?: string;
      choferCi?: string;
      tipoVehiculo?: string;
      color?: string;
      placa?: string;
      paradaActual?: string;
      puestoFila?: number;
      capacidadTotal?: number;
      estadoVehiculo?: string;
    },
  ) {
    const vehiculo = await this.obtenerPorId(id);
    const paradaOriginal = vehiculo.paradaActual;

    // Validación de campos manipulables antes de aplicar cambios.
    if (
      data.puestoFila !== undefined &&
      (!Number.isInteger(data.puestoFila) || data.puestoFila < 0)
    ) {
      throw new BadRequestException(
        'El puesto en la fila debe ser un número entero mayor o igual a cero.',
      );
    }
    if (
      data.paradaActual !== undefined &&
      !['cochabamba', 'eterazama', 'fuera_de_fila', 'en_ruta'].includes(
        data.paradaActual,
      )
    ) {
      throw new BadRequestException(
        'Parada no válida. Use cochabamba, eterazama o fuera_de_fila.',
      );
    }
    if (
      data.estadoVehiculo !== undefined &&
      !['activo', 'inactivo'].includes(data.estadoVehiculo)
    ) {
      throw new BadRequestException(
        'Estado del vehículo no válido. Use activo o inactivo.',
      );
    }

    if (data.choferNombre !== undefined) vehiculo.choferNombre = data.choferNombre;
    if (data.choferCi !== undefined) vehiculo.choferCi = data.choferCi ?? null;
    if (data.tipoVehiculo !== undefined) vehiculo.tipoVehiculo = data.tipoVehiculo;
    if (data.color !== undefined) vehiculo.color = data.color;
    if (data.placa !== undefined) vehiculo.placa = data.placa;
    if (data.paradaActual !== undefined) vehiculo.paradaActual = data.paradaActual;
    if (data.puestoFila !== undefined) vehiculo.puestoFila = data.puestoFila;
    if (data.estadoVehiculo !== undefined) vehiculo.estadoVehiculo = data.estadoVehiculo;

    if (data.capacidadTotal !== undefined) {
      const nuevaCapacidad = Math.floor(data.capacidadTotal);
      const maxOcupado = Math.max(0, ...(vehiculo.asientosOcupados || []));
      if (nuevaCapacidad < 4) {
        throw new BadRequestException(
          'La capacidad mínima debe ser de 4 asientos (2 del chofer + 2 de pasajeros).',
        );
      }
      if (nuevaCapacidad < maxOcupado) {
        throw new BadRequestException(
          `No se puede reducir la capacidad a ${nuevaCapacidad} porque el asiento ${maxOcupado} ya está vendido. Elimine o reembolse primero las ventas existentes.`,
        );
      }
      if (nuevaCapacidad < vehiculo.capacidadTotal) {
        // Los asientos del chofer deben caber dentro de la nueva capacidad
        const choferFuera = (vehiculo.asientosChofer || []).filter(
          (a) => a > nuevaCapacidad,
        );
        if (choferFuera.length > 0) {
          throw new BadRequestException(
            `No se puede reducir la capacidad porque los asientos del chofer ${choferFuera.join(', ')} quedarían fuera del rango.`,
          );
        }
        // Reconstruir la configuración para adaptarla a la nueva capacidad
        vehiculo.configuracionAsientos =
          generarConfiguracionPorDefecto(nuevaCapacidad);
      }
      if (nuevaCapacidad > vehiculo.capacidadTotal) {
        // Al ampliar la capacidad, reconstruir la configuración para incluir
        // los nuevos asientos. La secretaría podrá reconfigurarlos después.
        vehiculo.configuracionAsientos =
          generarConfiguracionPorDefecto(nuevaCapacidad);
      }
      vehiculo.capacidadTotal = nuevaCapacidad;
    }

    // Persistencia del puesto/parada/estado SIN dejar filas desincronizadas:
    // si la actualización toca una parada de fila (cambio de parada, puesto,
    // placa o estado), el guardado se hace bajo advisory lock (orden fijo) y se
    // reindexan las filas afectadas con el criterio OFICIAL.
    const esParadaFila = (p: string) =>
      p === 'cochabamba' || p === 'eterazama';
    const ordenFila = (p: string) =>
      esParadaFila(p) ? (p === 'cochabamba' ? 771001 : 771002) : 0;

    const paradasPorReindexar = new Set<string>();
    if (esParadaFila(paradaOriginal)) paradasPorReindexar.add(paradaOriginal);
    if (
      data.paradaActual !== undefined &&
      esParadaFila(data.paradaActual)
    ) {
      paradasPorReindexar.add(data.paradaActual);
    }
    // Si no hubo cambio de parada pero sí se tocó puesto/placa/estado, la fila
    // actual del vehículo también debe quedar consecutiva.
    if (paradasPorReindexar.size === 0 && esParadaFila(vehiculo.paradaActual)) {
      paradasPorReindexar.add(vehiculo.paradaActual);
    }

    const guardado =
      paradasPorReindexar.size > 0
        ? await this.vehiculoRepo.manager.transaction(async (m) => {
            const repo = m.getRepository(Vehiculo);
            const claves = Array.from(paradasPorReindexar)
              .map(ordenFila)
              .sort((a, b) => a - b);
            for (const clave of claves) {
              await m.query('SELECT pg_advisory_xact_lock($1)', [clave]);
            }
            const g = await repo.save(vehiculo);
            const placasOficiales =
              await this.placasChoferesOficialesActivos();
            const filas = Array.from(paradasPorReindexar).sort(
              (a, b) => ordenFila(a) - ordenFila(b),
            );
            for (const p of filas) {
              await reindexarFilaOficial(repo, p, placasOficiales);
            }
            return g;
          })
        : await this.vehiculoRepo.save(vehiculo);

    this.flotaGateway.notificarCambioFlota();
    return guardado;
  }
}
