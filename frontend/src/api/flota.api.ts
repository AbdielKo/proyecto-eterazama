import axios from "./axios";


import type {
Vehiculo
} from "../types/vehiculo";




export async function obtenerVehiculos(){


const respuesta =
await axios.get(
"/flota/todos"
);


return respuesta.data;


}




export async function crearVehiculo(
datos:Vehiculo
){


const respuesta =
await axios.post(
"/flota/nuevo",
datos
);


return respuesta.data;


}




export async function trasladarVehiculo(
id:number,
parada:string
){


const respuesta =
await axios.post(

`/flota/${id}/trasladar`,

{
parada
}

);


return respuesta.data;


}





export async function eliminarVehiculo(
id:number
){


const respuesta =
await axios.delete(

`/flota/${id}`

);


return respuesta.data;


}




export async function actualizarVehiculo(
  id:number,
  datos:Partial<Vehiculo>
){


const respuesta =
await axios.patch(

`/flota/${id}`,

datos

);


return respuesta.data;


}