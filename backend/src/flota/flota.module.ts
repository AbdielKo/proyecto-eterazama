import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlotaService } from './flota.service';
import { FlotaController } from './flota.controller';
import { Vehiculo } from './vehiculo.entity';
import { Usuario } from '../auth/usuario.entity';
import { Viaje } from '../chofer/entities/viaje.entity';
import { FlotaGateway } from './flota.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Vehiculo, Usuario, Viaje])],
  controllers: [FlotaController],
  providers: [FlotaService, FlotaGateway],
  exports: [FlotaService, FlotaGateway],
})
export class FlotaModule {}