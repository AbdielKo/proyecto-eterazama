import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { RolUsuario } from './roles';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos =
      this.reflector.getAllAndOverride<RolUsuario[]>(
        ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    const usuario = request.user;

    if (!usuario) {
      throw new ForbiddenException(
        'No se pudo identificar al usuario autenticado',
      );
    }

    if (!rolesPermitidos.includes(usuario.rol)) {
      throw new ForbiddenException(
        'No tienes permisos para realizar esta acción',
      );
    }

    return true;
  }
}