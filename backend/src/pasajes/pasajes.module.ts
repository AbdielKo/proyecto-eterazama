import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PasajesController } from './pasajes.controller';
import { PasajesService } from './pasajes.service';
import { Pasaje } from './pasaje.entity';
import { Configuracion } from '../secretaria/entities/configuracion.entity';
import { Vehiculo } from '../flota/vehiculo.entity';
import { FlotaModule } from '../flota/flota.module';
import { PdfService } from './pdf.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { SalidasModule } from '../salidas/salidas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pasaje, Configuracion, Vehiculo]),
    FlotaModule,
    NotificacionesModule,
    SalidasModule,
  ],
  controllers: [PasajesController],
  providers: [PasajesService, PdfService],
})
export class PasajesModule {}