import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { Vehiculo } from '../flota/vehiculo.entity';
import { Viaje } from '../chofer/entities/viaje.entity';
import { Pasaje } from '../pasajes/pasaje.entity';
import { Usuario } from '../auth/usuario.entity';
import { NotificacionChofer } from '../chofer/entities/notificacion.entity';
import { NotificacionPasajero } from '../notificaciones/notificacion-pasajero.entity';
import { NotificacionSecretaria } from './notificacion-secretaria.entity';

import { SalidasService } from './salidas.service';
import { NotificacionesSecretariaController } from './notificaciones-secretaria.controller';
import { NotificacionesSecretariaGateway } from './notificaciones-secretaria.gateway';

import { FlotaModule } from '../flota/flota.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

// Módulo central del flujo de SALIDA: por_salir (cuenta regresiva de 10 min),
// transición a EN RUTA y notificaciones a los 3 roles. Se importa desde
// chofer, secretaria y pasajes; NO importa ninguno de ellos (evita ciclos).
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Vehiculo,
      Viaje,
      Pasaje,
      Usuario,
      NotificacionChofer,
      NotificacionPasajero,
      NotificacionSecretaria,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        if (!jwtSecret) {
          throw new Error('JWT_SECRET no está configurado en el archivo .env');
        }
        return {
          secret: jwtSecret,
          signOptions: { expiresIn: '1d' },
        };
      },
    }),
    FlotaModule,
    NotificacionesModule,
  ],
  controllers: [NotificacionesSecretariaController],
  providers: [SalidasService, NotificacionesSecretariaGateway],
  exports: [SalidasService, NotificacionesSecretariaGateway],
})
export class SalidasModule {}