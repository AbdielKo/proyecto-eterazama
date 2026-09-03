import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehiculo } from './vehiculo.entity';
import { Viaje } from '../chofer/entities/viaje.entity';
import { FlotaGateway } from './flota.gateway';

@Injectable()
export class FlotaService {
  constructor(
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,

    @InjectRepository(Viaje)
    private readonly viajeRepo: Repository<Viaje>,

    private readonly flotaGateway: FlotaGateway,
  ) {}

  // La fuente de verdad del estado es el vehiculo en la base de datos.
  // Se complementa con el viaje actual (en ruta) para que Secretaria vea
  // origen, destino, hora de salida y pasajeros del mismo estado real.
  async obtenerTodos() {
    const vehiculos = await this.vehiculoRepo.find({
      order: { id: 'DESC' },
    });

    const viajes = await this.viajeRepo.find();

    return vehiculos.map((v) => {
      const viajeActual = viajes
        .filter((via) => via.placaVehiculo === v.placa)
        .sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime())[0];

      const ocupados = (v.asientosOcupados || []).length;
      const asientosLibres = Math.max(v.capacidadTotal - 2 - ocupados, 0);

      return {
        ...v,
        pasajeros: ocupados,
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
  }) {
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
    });
    const guardado = await this.vehiculoRepo.save(vehiculo);
    this.flotaGateway.notificarCambioFlota();
    return guardado;
  }

  async ocuparAsientos(id: number, asientos: number[]) {
    const vehiculo = await this.obtenerPorId(id);
    const nuevosAsientos = Array.from(new Set([...vehiculo.asientosOcupados, ...asientos]));
    vehiculo.asientosOcupados = nuevosAsientos;
    const guardado = await this.vehiculoRepo.save(vehiculo);
    this.flotaGateway.notificarCambioFlota();
    return guardado;
  }

  async trasladarVehiculo(id: number, nuevaParada: string) {
    const vehiculo = await this.obtenerPorId(id);
    vehiculo.paradaActual = nuevaParada;
    if (nuevaParada === 'en_ruta') {
      vehiculo.asientosOcupados = [];
    }
    const guardado = await this.vehiculoRepo.save(vehiculo);
    this.flotaGateway.notificarCambioFlota();
    return guardado;
  }

  async cambiarEstadoParada(id: number, nuevaParada: string) {
    return this.trasladarVehiculo(id, nuevaParada);
  }

  async reordenarFila(cambios: { id: number; puestoFila: number }[]) {
    for (const cambio of cambios) {
      await this.vehiculoRepo.update(cambio.id, { puestoFila: cambio.puestoFila });
    }
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
      vehiculo.capacidadTotal = nuevaCapacidad;
    }

    const guardado = await this.vehiculoRepo.save(vehiculo);
    this.flotaGateway.notificarCambioFlota();
    return guardado;
  }
}