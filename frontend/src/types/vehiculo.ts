export interface Vehiculo {
  id?: number;
  choferNombre: string;
  choferCi: string;
  tipoVehiculo: string;
  color: string;
  placa: string;
  paradaActual: string;
  puestoFila: number;
  qrImagenUrl?: string;
  asientosOcupados?: number[];
  fechaRegistro?: string;
  promedioEstrellas?: number;
  cantidadResenas?: number;
  capacidadTotal?: number;
  estadoVehiculo?: string;
  estadoViaje?: string;
  asientosLibres?: number;
  ocupadosTotal?: number;
  asientosChofer?: number[];
  pasajeros?: number;
  viajeActual?: {
    origen?: string;
    destino?: string;
    horaSalida?: string;
    estadoViaje?: string;
  } | null;
}