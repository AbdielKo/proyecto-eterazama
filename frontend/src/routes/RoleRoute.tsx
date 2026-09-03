import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import type { Rol } from "../types/usuario";

interface Props {
  children: ReactNode;
  rol: Rol;
}

export default function RoleRoute({ children, rol }: Props) {
  const { usuario } = useAuth();

  if (!usuario) {
    return <Navigate to="/" replace />;
  }

  const userRol = usuario.rol.toLowerCase().trim();
  const requiredRol = rol.toLowerCase().trim();

  const rolEquivalente =
    (userRol === "usuario" && requiredRol === "pasajero") ||
    (userRol === "pasajero" && requiredRol === "usuario");

  if (userRol !== requiredRol && !rolEquivalente) {
    const redirectMap: Record<string, string> = {
      secretaria: "/secretaria",
      chofer: "/chofer",
      usuario: "/pasajero",
      pasajero: "/pasajero",
    };
    return <Navigate to={redirectMap[userRol] || "/"} replace />;
  }

  return <>{children}</>;
}
