import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlotaService } from './flota.service';
import { FlotaController } from './flota.controller';
import { Vehiculo } from './vehiculo.entity';
import { Usuario } from '../auth/usuario.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vehiculo, Usuario])],
  controllers: [FlotaController],
  providers: [FlotaService],
  exports: [FlotaService],
})
export class FlotaModule {}