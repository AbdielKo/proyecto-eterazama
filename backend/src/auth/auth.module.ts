import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { Usuario } from './usuario.entity';

import { FlotaModule } from '../flota/flota.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    ConfigModule,

    FlotaModule,
    AuditoriaModule,

    TypeOrmModule.forFeature([
      Usuario,
    ]),

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        const jwtSecret =
          configService.get<string>('JWT_SECRET');

        if (!jwtSecret) {
          throw new Error(
            'JWT_SECRET no está configurado en el archivo .env',
          );
        }

        return {
          secret: jwtSecret,

          signOptions: {
            expiresIn: '1d',
          },
        };
      },
    }),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],

  exports: [
    AuthService,
    JwtModule,
    PassportModule,
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}