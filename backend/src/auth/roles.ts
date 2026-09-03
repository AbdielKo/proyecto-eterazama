export const ROLES = {
  USUARIO: 'usuario',
  CHOFER: 'chofer',
  SECRETARIA: 'secretaria',
} as const;

export type RolUsuario = (typeof ROLES)[keyof typeof ROLES];

export const ROLES_VALIDOS: RolUsuario[] = [
  ROLES.USUARIO,
  ROLES.CHOFER,
  ROLES.SECRETARIA,
];

export function esRolValido(rol: string): rol is RolUsuario {
  return ROLES_VALIDOS.includes(rol as RolUsuario);
}