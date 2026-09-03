import axios from "./axios";
import type {
  ParadasBoleteria,
  Pasaje,
  VehiculoBoleteria,
  VentaBoleteriaData,
} from "../types/pasaje";

export async function obtenerBoleteriaParadas(): Promise<ParadasBoleteria> {
  const respuesta = await axios.get("/secretaria/boleteria/paradas");
  return respuesta.data;
}

export async function obtenerVehiculoBoleteria(
  id: number
): Promise<VehiculoBoleteria> {
  const respuesta = await axios.get(`/secretaria/boleteria/vehiculo/${id}`);
  return respuesta.data;
}

export async function venderBoleteria(
  datos: VentaBoleteriaData
): Promise<Pasaje> {
  const respuesta = await axios.post("/secretaria/boleteria/venta", datos);
  return respuesta.data;
}