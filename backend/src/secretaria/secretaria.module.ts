import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SecretariaController } from './secretaria.controller';
import { SecretariaService } from './secretaria.service';

import { Usuario } from '../auth/usuario.entity';
import { Vehiculo } from '../flota/vehiculo.entity';
import { SolicitudRetiro } from '../flota/solicitud-retiro.entity';
import { Pasaje } from '../pasajes/pasaje.entity';
import { Review } from '../reviews/review.entity';
import { Viaje } from '../chofer/entities/viaje.entity';
import { Configuracion } from './entities/configuracion.entity';
import { FlotaModule } from '../flota/flota.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { SalidasModule } from '../salidas/salidas.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Usuario,
      Vehiculo,
      SolicitudRetiro,
      Pasaje,
      Review,
      Viaje,
      Configuracion,
    ]),
    FlotaModule,
    NotificacionesModule,
    SalidasModule,
    AuditoriaModule,
  ],
  controllers: [SecretariaController],
  providers: [SecretariaService],
  exports: [SecretariaService],
})
export class SecretariaModule {}
