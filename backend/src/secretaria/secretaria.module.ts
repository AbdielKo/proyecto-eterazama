import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecretariaController } from './secretaria.controller';
import { SecretariaService } from './secretaria.service';

import { Usuario } from '../auth/usuario.entity';
import { Vehiculo } from '../flota/vehiculo.entity';
import { Pasaje } from '../pasajes/pasaje.entity';
import { Review } from '../reviews/review.entity';
import { Viaje } from '../chofer/entities/viaje.entity';
import { Configuracion } from './entities/configuracion.entity';
import { FlotaModule } from '../flota/flota.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      Vehiculo,
      Pasaje,
      Review,
      Viaje,
      Configuracion,
    ]),
    FlotaModule,
  ],
  controllers: [SecretariaController],
  providers: [SecretariaService],
})
export class SecretariaModule {}
