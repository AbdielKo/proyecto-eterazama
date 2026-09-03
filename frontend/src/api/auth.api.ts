import api from "./axios";

import type {
  LoginResponse
} from "../types/usuario";


export interface RegistroData {

  nombreUsuario:string;

  password:string;

  nombre:string;

  apellidos:string;

  gmail?:string;

  telefono?:string;

}


export const loginRequest = async (
  nombreUsuario:string,
  password:string
):Promise<LoginResponse> => {

  const response = await api.post(
    "/auth/login",
    {
      nombreUsuario,
      password
    }
  );

  return response.data;

};



export const registroRequest = async (
  data:RegistroData
)=>{

  const response =
    await api.post(
      "/auth/registro",
      data
    );


  return response.data;

};
