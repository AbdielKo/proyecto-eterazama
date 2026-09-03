import {
  createContext,
  useState,
  type ReactNode
} from "react";


import type {
 Usuario
} from "../types/usuario";


interface AuthContextProps {

 children:ReactNode;

}


interface AuthContextValue {

 usuario:Usuario | null;

 token:string | null;

 login:
 (
 usuario:Usuario,
 token:string
 )=>void;


 logout:()=>void;

}



export const AuthContext =
createContext<AuthContextValue | null>(null);



export function AuthProvider(
{
 children
}:AuthContextProps
){


const [usuario,setUsuario]=
useState<Usuario | null>(

 ()=>{

 const data =
 localStorage.getItem(
 "usuario"
 );

 return data
 ?
 JSON.parse(data)
 :
 null;

 }

);



const [token,setToken]=
useState<string | null>(

 ()=>localStorage.getItem("token")

);



function login(
 usuario:Usuario,
 token:string
){


 setUsuario(usuario);

 setToken(token);


 localStorage.setItem(
 "usuario",
 JSON.stringify(usuario)
 );


 localStorage.setItem(
 "token",
 token
 );


}



function logout(){

 setUsuario(null);

 setToken(null);


 localStorage.removeItem(
 "usuario"
 );


 localStorage.removeItem(
 "token"
 );

}



return (

<AuthContext.Provider
value={{
 usuario,
 token,
 login,
 logout
}}
>

{children}

</AuthContext.Provider>

);


}