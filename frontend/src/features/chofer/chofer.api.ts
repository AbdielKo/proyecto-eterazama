import api from "../../api/axios";
import type {
  ChoferInicio,
  MiVehiculo,
  MiFila,
  MiViaje,
  ValidacionQR,
  NotificacionChofer,
  EstadisticasChofer,
  PerfilChofer,
  EstadoVehiculoActualizado,
} from "./chofer.types";


export async function obtenerInicio(): Promise<ChoferInicio> {
  const res = await api.get("/chofer/inicio");
  return res.data;
}


export async function obtenerMiVehiculo(): Promise<MiVehiculo> {
  const res = await api.get("/chofer/vehiculo");
  return res.data;
}


export async function obtenerMiFila(): Promise<MiFila> {
  const res = await api.get("/chofer/fila");
  return res.data;
}

export async function anotarseEnFila(parada: string): Promise<{ paradaActual: string; puestoFila: number; horaIngresoFila?: string | null; mensaje: string }> {
  const res = await api.post("/chofer/fila/anotarse", { parada });
  return res.data;
}

export async function salirDeFila(): Promise<{ paradaActual: string; mensaje: string }> {
  const res = await api.post("/chofer/fila/salir");
  return res.data;
}


export async function validarBoletoQR(codigoQR: string): Promise<ValidacionQR> {
  const res = await api.post("/chofer/validar-qr", { codigoQR });
  return res.data;
}

export async function confirmarAbordajeQR(boletoId: string) {
  const res = await api.post(`/chofer/validar-qr/${boletoId}/confirmar`);
  return res.data;
}


export async function cambiarEstadoVehiculo(estado: string): Promise<EstadoVehiculoActualizado> {
  const res = await api.patch("/chofer/estado-vehiculo", { estado });
  return res.data;
}

export async function cambiarEstadoViaje(estado: string): Promise<EstadoVehiculoActualizado> {
  const res = await api.patch("/chofer/estado-viaje", { estado });
  return res.data;
}


export async function obtenerHistorialViajes(filtro?: string): Promise<MiViaje[]> {
  const params = filtro ? { filtro } : {};
  const res = await api.get("/chofer/historial", { params });
  return res.data;
}


export async function obtenerMisEstadisticas(periodo?: string): Promise<EstadisticasChofer> {
  const params = periodo ? { periodo } : {};
  const res = await api.get("/chofer/estadisticas", { params });
  return res.data;
}


export async function obtenerNotificaciones(): Promise<NotificacionChofer[]> {
  const res = await api.get("/chofer/notificaciones");
  return res.data;
}

export async function marcarNotificacionLeida(notificacionId: string) {
  const res = await api.patch(`/chofer/notificaciones/${notificacionId}/leer`);
  return res.data;
}

export async function marcarTodasLeidas() {
  const res = await api.patch("/chofer/notificaciones/todas-leer");
  return res.data;
}


export async function obtenerPerfil(): Promise<PerfilChofer> {
  const res = await api.get("/chofer/perfil");
  return res.data;
}

export async function actualizarPerfil(datos: {
  nombre?: string;
  apellidos?: string;
  telefono?: string;
}): Promise<PerfilChofer> {
  const res = await api.patch("/chofer/perfil", datos);
  return res.data;
}
