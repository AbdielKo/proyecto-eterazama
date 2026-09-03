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

export async function obtenerVentasSecretaria(params: {
  periodo?: string;
  choferId?: string;
  placa?: string;
}): Promise<VentasResponse> {
  const respuesta = await api.get("/secretaria/ventas", { params });
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
