import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface Props {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const { token } = useAuth();

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
