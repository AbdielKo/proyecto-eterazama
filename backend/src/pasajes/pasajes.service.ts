import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Pasaje } from './pasaje.entity';
import { FlotaService } from '../flota/flota.service';
import { RegistrarVentaDto } from './dto/registrar-venta.dto';

@Injectable()
export class PasajesService {
  constructor(
    @InjectRepository(Pasaje)
    private readonly pasajeRepo: Repository<Pasaje>,
    private readonly flotaService: FlotaService,
  ) {}

  async registrarVenta(data: RegistrarVentaDto) {
    const montoTotal = Number(data.montoAsientos) + Number(data.montoEncomienda);

    const nuevoPasaje = this.pasajeRepo.create({
      ...data,
      montoTotal,
    });
    const pasajeGuardado = await this.pasajeRepo.save(nuevoPasaje);

    if (data.asientos && data.asientos.length > 0) {
      await this.flotaService.ocuparAsientos(data.vehiculoId, data.asientos);
    }

    return pasajeGuardado;
  }

  obtenerHistorial() {
    return this.pasajeRepo.find({
      order: { fechaCreacion: 'DESC' },
    });
  }

  async obtenerPorId(id: string) {
    const pasaje = await this.pasajeRepo.findOneBy({ id });
    if (!pasaje) throw new NotFoundException('Pasaje no encontrado');
    return pasaje;
  }

  obtenerPorPlaca(placa: string) {
    return this.pasajeRepo.find({
      where: { placaVehiculo: placa },
      order: { fechaCreacion: 'DESC' },
    });
  }

  async obtenerCierreCaja() {
    const pasajes = await this.pasajeRepo.find();
    
    let totalAsientos = 0;
    let totalEncomiendas = 0;
    let totalCaja = 0;

    pasajes.forEach((p) => {
      totalAsientos += Number(p.montoAsientos);
      totalEncomiendas += Number(p.montoEncomienda);
      totalCaja += Number(p.montoTotal);
    });

    return {
      totalBoletosEmitidos: pasajes.length,
      subtotalAsientos: totalAsientos,
      subtotalEncomiendas: totalEncomiendas,
      montoTotalCaja: totalCaja,
    };
  }

  async obtenerVentasDelDia() {
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);

    const finDia = new Date();
    finDia.setHours(23, 59, 59, 999);

    const pasajesHoy = await this.pasajeRepo.find({
      where: {
        fechaCreacion: Between(inicioDia, finDia),
      },
      order: { fechaCreacion: 'DESC' },
    });

    const totalHoy = pasajesHoy.reduce((acc, item) => acc + Number(item.montoTotal), 0);

    return {
      fecha: inicioDia.toISOString().split('T')[0],
      totalVentasHoy: pasajesHoy.length,
      montoTotalHoy: totalHoy,
      detalles: pasajesHoy,
    };
  }
}