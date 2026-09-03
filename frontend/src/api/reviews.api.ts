import api from "./axios";
import type { Review, EstadisticasReviews } from "../types/review";

export async function obtenerEstadisticasReviews(): Promise<EstadisticasReviews> {
  const respuesta = await api.get("/reviews/graficas");
  const data = respuesta.data;

  if (Array.isArray(data) && data.length > 0) {
    const promedio = data.reduce((acc: number, r: { promedio?: number }) => acc + (r.promedio || 0), 0) / data.length;
    return { promedio: Math.round(promedio * 10) / 10, total: data.length, distribucion: {} };
  }
  return { promedio: 0, total: 0, distribucion: {} };
}

export async function obtenerReviews(): Promise<Review[]> {
  const respuesta = await api.get("/reviews/graficas");
  return respuesta.data;
}

export async function crearReview(datos: {
  usuarioId: string;
  vehiculoId: number;
  pasajeId?: string;
  estrellas: number;
  comentario?: string;
}): Promise<Review> {
  const respuesta = await api.post("/reviews", datos);
  return respuesta.data;
}
