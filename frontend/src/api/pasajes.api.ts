import axios from "./axios";


// Registrar venta
export async function registrarVenta(datos:any){

const respuesta =
await axios.post(
"/pasajes/venta",
datos
);

return respuesta.data;

}



// Obtener ventas del día
export async function obtenerVentasDelDia(){

const respuesta =
await axios.get(
"/pasajes/hoy"
);

return respuesta.data;

}



// Obtener historial completo
export async function obtenerPasajes(){

const respuesta =
await axios.get(
"/pasajes/historial"
);

return respuesta.data;

}



// Caja central
export async function obtenerCaja(){

const respuesta =
await axios.get(
"/pasajes/caja"
);

return respuesta.data;

}



// Obtener pasaje por ID
export async function obtenerPasajePorId(
id:string
){

const respuesta =
await axios.get(
`/pasajes/${id}`
);

return respuesta.data;

}


// Solicitar cancelación / reembolso (rol usuario). Deja el pasaje PENDIENTE.
export async function solicitarCancelacion(
id:string,
motivo?:string
){

const respuesta =
await axios.post(
`/pasajes/${id}/cancelar`,
{ motivo: motivo || "" }
);

return respuesta.data;

}



// Obtener por placa
export async function obtenerPorPlaca(
placa:string
){

const respuesta =
await axios.get(
`/pasajes/vehiculo/${placa}`
);

return respuesta.data;

}
