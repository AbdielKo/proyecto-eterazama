import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehiculo } from './vehiculo.entity';

@Injectable()
export class FlotaService {
  constructor(
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepo: Repository<Vehiculo>,
  ) {}

  obtenerTodos() {
    return this.vehiculoRepo.find({
      order: { id: 'DESC' },
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

  async crearVehiculo(data: {
    choferNombre: string;
    choferCi?: string;
    qrImagenUrl?: string;
    tipoVehiculo: string;
    color: string;
    placa: string;
    paradaActual?: string;
    puestoFila?: number;
  }) {
    const vehiculo = this.vehiculoRepo.create({
      choferNombre: data.choferNombre,
      choferCi: data.choferCi,
      qrImagenUrl: data.qrImagenUrl,
      tipoVehiculo: data.tipoVehiculo,
      color: data.color,
      placa: data.placa,
      paradaActual: data.paradaActual || 'fuera_de_fila',
      puestoFila: data.puestoFila || 0,
    });
    return this.vehiculoRepo.save(vehiculo);
  }

  async ocuparAsientos(id: number, asientos: number[]) {
    const vehiculo = await this.obtenerPorId(id);
    const nuevosAsientos = Array.from(new Set([...vehiculo.asientosOcupados, ...asientos]));
    vehiculo.asientosOcupados = nuevosAsientos;
    return this.vehiculoRepo.save(vehiculo);
  }

  async trasladarVehiculo(id: number, nuevaParada: string) {
    const vehiculo = await this.obtenerPorId(id);
    vehiculo.paradaActual = nuevaParada;
    if (nuevaParada === 'en_ruta') {
      vehiculo.asientosOcupados = [];
    }
    return this.vehiculoRepo.save(vehiculo);
  }

  async cambiarEstadoParada(id: number, nuevaParada: string) {
    return this.trasladarVehiculo(id, nuevaParada);
  }

  async reordenarFila(cambios: { id: number; puestoFila: number }[]) {
    for (const cambio of cambios) {
      await this.vehiculoRepo.update(cambio.id, { puestoFila: cambio.puestoFila });
    }
    return { status: 'Fila reordenada exitosamente' };
  }

  async eliminarVehiculo(id: number) {
    const res = await this.vehiculoRepo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Vehículo no encontrado');
    return { status: 'Vehículo eliminado correctamente' };
  }
}