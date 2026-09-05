import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlotaModule } from './flota/flota.module';
import { PasajesModule } from './pasajes/pasajes.module';
import { AuthModule } from './auth/auth.module';
import { ReviewModule } from './reviews/review.module';
import { ChoferModule } from './chofer/chofer.module';
import { SecretariaModule } from './secretaria/secretaria.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { SalidasModule } from './salidas/salidas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USER'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    FlotaModule,
    PasajesModule,
    AuthModule,
    ReviewModule,
    ChoferModule,
    SecretariaModule,
    NotificacionesModule,
    SalidasModule,
  ],
})
export class AppModule {}