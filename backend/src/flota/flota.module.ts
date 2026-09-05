import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlotaService } from './flota.service';
import { FlotaController } from './flota.controller';
import { Vehiculo } from './vehiculo.entity';
import { TipoVehiculo } from './tipo-vehiculo.entity';
import { SolicitudRetiro } from './solicitud-retiro.entity';
import { Usuario } from '../auth/usuario.entity';
import { Viaje } from '../chofer/entities/viaje.entity';
import { FlotaGateway } from './flota.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehiculo,
      TipoVehiculo,
      SolicitudRetiro,
      Usuario,
      Viaje,
    ]),
  ],
  controllers: [FlotaController],
  providers: [FlotaService, FlotaGateway],
  exports: [FlotaService, FlotaGateway, TypeOrmModule],
})
export class FlotaModule {}