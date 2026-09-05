export type NotificacionPasajero = {
  id: string;
  usuarioId: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fechaCreacion: string;
};