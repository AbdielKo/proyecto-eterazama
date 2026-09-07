import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChoferController } from './chofer.controller';
import { ChoferService } from './chofer.service';
import { Vehiculo } from '../flota/vehiculo.entity';
import { TipoVehiculo } from '../flota/tipo-vehiculo.entity';
import { SolicitudRetiro } from '../flota/solicitud-retiro.entity';
import { Viaje } from './entities/viaje.entity';
import { Boleto } from './entities/boleto.entity';
import { NotificacionChofer } from './entities/notificacion.entity';
import { Liquidacion } from './entities/liquidacion.entity';
import { Pasaje } from '../pasajes/pasaje.entity';
import { Review } from '../reviews/review.entity';
import { Usuario } from '../auth/usuario.entity';
import { FlotaModule } from '../flota/flota.module';
import { SalidasModule } from '../salidas/salidas.module';
import { SecretariaModule } from '../secretaria/secretaria.module';
import { PasajesModule } from '../pasajes/pasajes.module';

@Module({
  imports: [
    FlotaModule,
    SalidasModule,
    SecretariaModule,
    PasajesModule,
    TypeOrmModule.forFeature([
      Vehiculo,
      TipoVehiculo,
      SolicitudRetiro,
      Viaje,
      Boleto,
      NotificacionChofer,
      Liquidacion,
      Pasaje,
      Review,
      Usuario,
    ]),
  ],
  controllers: [ChoferController],
  providers: [ChoferService],
})
export class ChoferModule {}
