import api from "./axios";
import type { NotificacionPasajero } from "../features/pasajero/pasajero.types";

// Notificaciones del pasajero (rol usuario). El backend identifica al
// destinatario con req.user.userId del JWT, nunca con un id del frontend.
export async function obtenerNotificaciones(): Promise<NotificacionPasajero[]> {
  const res = await api.get("/notificaciones");
  return res.data;
}

export async function marcarNotificacionLeida(
  notificacionId: string
): Promise<NotificacionPasajero> {
  const res = await api.patch(`/notificaciones/${notificacionId}/leer`);
  return res.data;
}

export async function marcarTodasLeidas() {
  const res = await api.patch("/notificaciones/todas-leer");
  return res.data;
}