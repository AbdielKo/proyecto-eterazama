import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from './roles';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: RolUsuario[]) =>
  SetMetadata(ROLES_KEY, roles);