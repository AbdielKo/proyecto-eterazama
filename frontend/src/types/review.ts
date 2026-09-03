export interface Review {
  id: string;
  usuarioId: string;
  vehiculoId: number;
  pasajeId: string;
  estrellas: number;
  comentario?: string;
  fechaCreacion?: string;
  chofer?: string;
  placa?: string;
  nombreUsuario?: string;
}

export interface EstadisticasReviews {
  promedio: number;
  total: number;
  distribucion?: Record<number, number>;
}
