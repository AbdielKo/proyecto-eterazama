import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './usuario.entity';

interface JwtPayload {
  sub: string;
  usuario: string;
  rol: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      throw new Error(
        'JWT_SECRET no está configurado en el archivo .env',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  // Se revalida contra la base de datos en CADA petición: si el usuario fue
  // eliminado o bloqueado después de firmar el token, la sesión se invalida.
  // El rol se toma SIEMPRE del estado actual en BD (nunca del token) para que
  // un cambio de rol/bloqueo se refleje de inmediato.
  async validate(payload: JwtPayload) {
    const usuario = await this.usuarioRepo.findOne({
      where: { id: payload.sub },
    });

    if (!usuario) {
      throw new UnauthorizedException(
        'El usuario ya no existe. Inicie sesión nuevamente.',
      );
    }

    if (usuario.cuentaBloqueada || usuario.estado === 'bloqueado') {
      throw new UnauthorizedException(
        'Cuenta bloqueada. La Secretaría debe desbloquearla.',
      );
    }

    return {
      userId: payload.sub,
      username: payload.usuario,
      rol: usuario.rol,
      estadoUsuario: usuario.estado,
    };
  }
}