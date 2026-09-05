export interface ChoferInicio {
  nombre: string;
  estadoServicio?: string;
  vehiculo: string | null;
  placa: string | null;
  paradaActual: string | null;
  puestoFila: number | null;
  estadoVehiculo: string | null;
  estadoViaje: string | null;
  pasajerosCount: number;
  asientosOcupados: number;
  asientosDisponibles: number;
  calificacionPromedio: number;
  configuracionPendiente?: boolean;
}

export interface MapaAsientoChofer {
  numero: number;
  estado: "chofer" | "ocupado" | "disponible";
  pasajero: string | null;
  estadoPasaje: string | null;
}

export interface MiVehiculo {
  id: number;
  placa: string;
  tipoVehiculo: string;
  choferNombre: string;
  choferCi: string | null;
  color: string;
  capacidadTotal: number;
  estadoVehiculo: string;
  estadoViaje: string;
  salidaProgramada?: string | null;
  qrImagenUrl: string | null;
  paradaActual: string;
  puestoFila: number;
  horaIngresoFila: string | null;
  fechaEstado: string | null;
  asientosOcupados: number[];
  asientosChofer: number[];
  configuracionPendiente?: boolean;
  configuracionAsientos?: { ancho: number; filas: (number | null)[][] } | null;
  ocupadosTotal: number;
  asientosLibres: number;
  mapaAsientos: MapaAsientoChofer[];
}

export interface VehiculoFila {
  placa: string;
  tipoVehiculo: string;
  color: string;
  puestoFila: number;
  choferNombre: string;
  choferCi: string | null;
  estado: string;
  estadoViaje?: string;
  salidaProgramada?: string | null;
  horaIngresoFila: string | null;
  pasajeros?: number;
}

export interface MiFila {
  ubicacion: string;
  paradaActual: string;
  yaRegistrado: boolean;
  miPuesto: number;
  posicionEnFila: number;
  totalEnFila: number;
  estadoVehiculo: string;
  estadoViaje: string;
  salidaProgramada?: string | null;
  cochabamba: VehiculoFila[];
  eterazama: VehiculoFila[];
  porSalir: VehiculoFila[];
  enRuta: VehiculoFila[];
  fueraDeFila: VehiculoFila[];
  delante: VehiculoFila[];
  detras: VehiculoFila[];
}

export interface CambiarUbicacionRespuesta {
  paradaActual: "cochabamba" | "eterazama";
  puestoFila: number;
  mensaje: string;
}

export interface EstadoVehiculoActualizado {
  estadoVehiculo: string;
  estadoViaje: string;
  paradaActual: string;
  fechaEstado: string | null;
}

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

export interface RespuestaSolicitarRetiro {
  solicitud: SolicitudRetiro;
  aprobacionAutomatica: boolean;
  mensaje: string;
}

export interface MiViaje {
  id: string;
  placaVehiculo: string;
  choferNombre: string;
  origen: string;
  destino: string;
  fecha: string;
  horaSalida: string;
  horaLlegada: string;
  estado: string;
  asientosOcupados: number;
  capacidadTotal: number;
  totalGenerado: number;
  pasajerosTransportados: number;
  pasajerosRegistrados?: number;
  asientosDisponibles?: number;
  fechaCreacion?: string;
}

export interface ValidacionQR {
  valido: boolean;
  boleto: {
    id: string;
    pasajeroNombre: string;
    asiento: number;
    origen: string;
    destino: string;
    monto: number;
    estadoPago: string;
    estadoBoleto: string;
  };
}

export interface NotificacionChofer {
  id: string;
  choferId: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fechaCreacion: string;
}

export interface EstadisticasChofer {
  totalViajes: number;
  totalPasajeros: number;
  promedioPasajerosPorViaje: number;
  promedioCalificacion: number;
  cantidadResenas: number;
  graficoViajes: {
    fecha: string;
    viajes: number;
    pasajeros: number;
    generado: number;
  }[];
}

export interface PerfilChofer {
  id: string;
  nombreUsuario: string;
  nombre: string | null;
  apellidos: string | null;
  gmail: string | null;
  telefono: string | null;
  rol: string;
  estado?: string;
  placaAsignada: string | null;
  fechaRegistro: string;
}
