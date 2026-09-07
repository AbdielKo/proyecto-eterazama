export type Rol =
  | "pasajero"
  | "chofer"
  | "secretaria";


export interface Usuario {
  id: number;
  nombreUsuario: string;
  nombre?: string;
  apellidos?: string;
  gmail?: string;
  telefono?: string;
  rol: Rol;
  placaAsignada?: string;
  fotoUrl?: string;
  intentosFallidos?: number;
  nivelBloqueo?: number;
  bloqueoTemporalHasta?: string | null;
  cuentaBloqueada?: boolean;
}


export interface LoginResponse {

  usuario: Usuario;

  access_token: string;

}