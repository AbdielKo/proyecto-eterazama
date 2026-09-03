import type { Vehiculo } from "./vehiculo";

export interface PasajeroAsiento {
  asiento: number;
  nombre: string;
  ci?: string;
  telefono?: string;
}

export interface Pasaje {
  id: string;
  pasajeroNombre: string;
  placaVehiculo: string;
  asientos: number[];
  montoAsientos: number;
  montoEncomienda: number;
  montoTotal: number;
  tramo: string;
  contactoRecibo?: string;
  fechaCreacion?: string;
  estado?: string;
  codigo?: string;
  origen?: string;
  destino?: string;
  vehiculoId?: number;
  pasajeros?: PasajeroAsiento[];
  metodoPago?: string;
  ciRecibo?: string;
  telefonoRecibo?: string;
  estadoReembolso?: "PENDIENTE" | "REEMBOLSADO" | string | null;
  motivoCancelacion?: string | null;
  secretariaReembolso?: string | null;
  montoReembolsado?: number | null;
  fechaReembolso?: string | null;
  vehiculoEstadoViaje?: string | null;
  vehiculoEstado?: string | null;
  puedeReembolsar?: boolean;
}

export interface VentaData {
  pasajeroNombre: string;
  placaVehiculo: string;
  asientos: number[];
  montoAsientos: number;
  montoEncomienda: number;
  montoTotal: number;
  tramo: string;
  contactoRecibo?: string;
}

export interface VentaBoleteriaData {
  vehiculoId: number;
  asientos: number[];
  pasajeros: PasajeroAsiento[];
  tramo: "cochabamba" | "eterazama";
  contactoRecibo: string;
  ciRecibo?: string;
  telefonoRecibo?: string;
  montoEncomienda: number;
  metodoPago: "EFECTIVO";
}

export interface PreciosBoleteria {
  cochabamba: number;
  eterazama: number;
}

export interface ParadasBoleteria {
  cochabamba: VehiculoBoleteria[];
  eterazama: VehiculoBoleteria[];
  precios: PreciosBoleteria;
}

export interface VehiculoBoleteria extends Vehiculo {
  ocupadosTotal: number;
  asientosChofer: number[];
  pasajes?: Pasaje[];
}

export interface CajaData {
  totalBoletosEmitidos: number;
  subtotalAsientos: number;
  subtotalEncomiendas: number;
  montoTotalCaja: number;
}

export interface VentasDiaData {
  totalVentasHoy: number;
  montoTotalHoy: number;
}