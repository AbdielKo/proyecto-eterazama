import api from "./axios";
import type { Pasaje } from "../types/pasaje";

export interface NominaItem {
  id: string;
  nombreCompleto: string;
  nombreUsuario: string;
  ci: string;
  telefono: string;
  gmail?: string;
  estado: string;
  vehiculo: string | null;
  placa: string | null;
  vehiculoId?: number | null;
  tipoVehiculo?: string | null;
  color?: string | null;
  capacidadTotal?: number | null;
  paradaActual?: string;
  estadoVehiculo?: string;
  totalViajes: number;
  promedioCalificacion: number;
  cantidadResenas: number;
}

export interface ResenaComentario {
  id: string;
  estrellas: number;
  comentario?: string;
  fechaCreacion?: string;
}

export interface ResenasChofer {
  chofer: string;
  placa: string | null;
  promedio: number;
  cantidad: number;
  distribucion: Record<number, number>;
  comentarios: ResenaComentario[];
}

export interface GraficaChofer {
  chofer: string;
  placa: string | null;
  chartData: { fecha: string; promedio: number }[];
  promedio: number;
  cantidad: number;
  distribucion: Record<number, number>;
  comentarios: ResenaComentario[];
}

export interface VentasResponse {
  ventas: Pasaje[];
  resumen: {
    cantidadVentas: number;
    totalBs: number;
    totalPasajes: number;
    totalEncomiendas: number;
  };
}

export interface CajaSecretaria {
  totalBoletosEmitidos: number;
  totalVentas: number;
  subtotalAsientos: number;
  subtotalEncomiendas: number;
  montoTotalCaja: number;
}

export interface ConfiguracionSindicato {
  id: number;
  nombreSindicato: string;
  telefono: string;
  email: string;
  direccion: string;
  precioCochabamba: number;
  precioEterazama: number;
  horarioApertura: string;
  horarioCierre: string;
  actualizadoEn?: string;
}

export interface ActualizarConfiguracionData {
  nombreSindicato?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  precioCochabamba: number;
  precioEterazama: number;
  horarioApertura?: string;
  horarioCierre?: string;
}

export async function obtenerNomina(): Promise<NominaItem[]> {
  const respuesta = await api.get("/secretaria/nomina");
  return respuesta.data;
}

// =============================================================
// CHOFERES ACTIVOS (submenú de Secretaría, estado en tiempo real)
// =============================================================

export interface ChoferActivo {
  id: string;
  choferNombre: string;
  placa: string | null;
  estadoServicio: string;
  ubicacion: string;
  estadoFila: "en_fila_cochabamba" | "en_fila_eterazama" | "ubicado" | "fuera";
  puestoFila: number;
  pasajeros: number;
  estadoDelViaje: string;
  estadoVehiculo: string;
  noAnotado: boolean;
  viajeActual:
    | { origen: string | null; destino: string | null; estadoViaje: string }
    | null;
}

export async function obtenerChoferesActivos(): Promise<ChoferActivo[]> {
  const respuesta = await api.get("/secretaria/choferes-activos");
  return respuesta.data;
}

export interface VehiculosSinChofer {
  cantidad: number;
  vehiculos: { id: number; placa: string; choferNombre: string }[];
}

export async function obtenerVehiculosSinChofer(): Promise<VehiculosSinChofer> {
  const respuesta = await api.get("/secretaria/vehiculos-sin-chofer");
  return respuesta.data;
}

export async function obtenerVentasSecretaria(params: {
  periodo?: string;
  choferId?: string;
  placa?: string;
}): Promise<VentasResponse> {
  const respuesta = await api.get("/secretaria/ventas", { params });
  return respuesta.data;
}

// =============================================================
// DETALLE DE VENTA (modal de consulta del historial)
// Solo lectura: nunca modifica registros.
// =============================================================

export interface VehiculoDetalleVenta {
  placa: string;
  tipoVehiculo: string;
  color: string;
  choferNombre: string;
  choferCi?: string | null;
  capacidadTotal: number;
}

export interface UsuarioDetalleVenta {
  id: string;
  nombreUsuario: string;
  nombre: string | null;
  apellidos: string | null;
  gmail: string | null;
  telefono: string | null;
  rol: string;
}

export interface DetalleVenta {
  venta: Pasaje;
  vehiculo: VehiculoDetalleVenta | null;
  pasajeroUsuario: UsuarioDetalleVenta | null;
  precioPorAsiento: number | null;
}

export async function obtenerDetalleVenta(id: string): Promise<DetalleVenta> {
  const respuesta = await api.get(`/secretaria/ventas/${id}`);
  return respuesta.data;
}

export async function obtenerCajaSecretaria(): Promise<CajaSecretaria> {
  const respuesta = await api.get("/secretaria/caja");
  return respuesta.data;
}

export async function obtenerReembolsosSecretaria(): Promise<Pasaje[]> {
  const respuesta = await api.get("/secretaria/reembolsos");
  return respuesta.data;
}

export async function confirmarReembolsoSecretaria(
  pasajeId: string,
  motivo: string
): Promise<Pasaje> {
  const respuesta = await api.post(
    `/secretaria/reembolsos/${pasajeId}/confirmar`,
    { motivo }
  );
  return respuesta.data;
}

export async function obtenerConfiguracionSecretaria(): Promise<ConfiguracionSindicato> {
  const respuesta = await api.get("/secretaria/configuracion");
  return respuesta.data;
}

export async function actualizarConfiguracionSecretaria(
  datos: ActualizarConfiguracionData
): Promise<ConfiguracionSindicato> {
  const respuesta = await api.put("/secretaria/configuracion", datos);
  return respuesta.data;
}

export async function obtenerResenasChofer(
  choferId: string,
): Promise<ResenasChofer> {
  const respuesta = await api.get(`/secretaria/resenas/${choferId}`);
  return respuesta.data;
}

export async function obtenerGraficasChofer(
  choferId: string,
  periodo: string,
): Promise<GraficaChofer> {
  const respuesta = await api.get(`/secretaria/graficas/${choferId}`, {
    params: { periodo },
  });
  return respuesta.data;
}

export async function crearChofer(datos: {
  nombreUsuario: string;
  password: string;
  nombre?: string;
  apellidos?: string;
  gmail?: string;
  telefono?: string;
  ci?: string;
  placa?: string;
  capacidadTotal?: number;
  tipoVehiculo?: string;
  color?: string;
  filas?: (number | null)[][];
  asientosChofer?: number[];
}) {
  const respuesta = await api.post("/auth/secretaria/choferes", datos);
  return respuesta.data;
}

export async function asignarRolChofer(userId: string) {
  const respuesta = await api.patch(`/auth/secretaria/usuario/${userId}/rol`, {
    rol: "chofer",
  });
  return respuesta.data;
}

export async function desbloquearCuenta(
  userId: string
): Promise<{ mensaje: string }> {
  const respuesta = await api.patch(`/auth/usuarios/${userId}/desbloquear`);
  return respuesta.data;
}

// =============================================================
// SOLICITUDES DE RETIRO DE LA FILA
// =============================================================

export interface SolicitudRetiro {
  id: string;
  choferId: string;
  choferNombre: string | null;
  placa: string;
  vehiculoId: number | null;
  parada: string;
  puestoFila: number;
  tienePasajeros: boolean;
  cantidadAsientos: number;
  motivo: string;
  estado: "PENDIENTE" | "ACEPTADA" | "RECHAZADA";
  procesadoPor: string | null;
  comentarioRespuesta: string | null;
  fechaCreacion?: string;
}

export async function obtenerSolicitudesRetiro(
  estado?: string
): Promise<SolicitudRetiro[]> {
  const params = estado ? { estado } : {};
  const respuesta = await api.get("/secretaria/retiros", { params });
  return respuesta.data;
}

export async function aprobarRetiro(
  id: string,
  comentario?: string
): Promise<any> {
  const respuesta = await api.patch(`/secretaria/retiros/${id}/aprobar`, {
    comentario,
  });
  return respuesta.data;
}

export async function rechazarRetiro(
  id: string,
  comentario?: string
): Promise<any> {
  const respuesta = await api.patch(`/secretaria/retiros/${id}/rechazar`, {
    comentario,
  });
  return respuesta.data;
}

// =============================================================
// MOVIMIENTOS DE LA SECRETARÍA (bitácora de auditoría inmutable)
// Solo lectura: el backend registra cada acción automáticamente con el
// usuario del JWT; aquí solo se consulta y filtra. No existe forma de
// crear, modificar o eliminar movimientos desde la API.
// =============================================================

export interface MovimientoSecretaria {
  id: string;
  fechaHora: string;
  usuarioId: string;
  usuarioNombre: string;
  rol: string;
  accion: string;
  modulo: string;
  detalle: string | null;
  registroId: string | null;
  datosAnteriores: Record<string, unknown> | null;
  datosNuevos: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface FiltrosMovimientos {
  busqueda?: string;
  usuario?: string;
  modulo?: string;
  accion?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  pageSize?: number;
}

export interface MovimientosResponse {
  movimientos: MovimientoSecretaria[];
  total: number;
  page: number;
  pageSize: number;
}

export async function obtenerMovimientosSecretaria(
  filtros: FiltrosMovimientos = {}
): Promise<MovimientosResponse> {
  const respuesta = await api.get("/secretaria/movimientos", { params: filtros });
  return respuesta.data;
}

export async function obtenerMovimientoSecretaria(
  id: string
): Promise<MovimientoSecretaria> {
  const respuesta = await api.get(`/secretaria/movimientos/${id}`);
  return respuesta.data;
}

// =============================================================
// NOTIFICACIONES DEL ROL SECRETARIA (flujo de salida)
// Persistidas en PostgreSQL (tabla notificaciones_secretaria).
// =============================================================

export interface NotificacionSecretaria {
  id: string;
  secretariaId: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fechaCreacion: string;
}

export async function obtenerNotificacionesSecretaria(): Promise<NotificacionSecretaria[]> {
  const respuesta = await api.get("/secretaria/notificaciones");
  return respuesta.data;
}

export async function marcarNotificacionSecretariaLeida(
  id: string
): Promise<NotificacionSecretaria> {
  const respuesta = await api.patch(`/secretaria/notificaciones/${id}/leer`);
  return respuesta.data;
}

export async function marcarTodasNotificacionesSecretariaLeidas(): Promise<{
  actualizadas: number;
}> {
  const respuesta = await api.patch("/secretaria/notificaciones/todas-leer");
  return respuesta.data;
}
