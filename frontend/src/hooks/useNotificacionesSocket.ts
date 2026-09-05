import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";

// Escucha en tiempo real las notificaciones del pasajero. El cliente se
// identifica con su JWT para entrar al room `pasajero:{userId}` del servidor.
// La fuente de verdad es PostgreSQL: si el WS falla, al recargar la página el
// GET /notificaciones entrega todo lo persistido.
export function useNotificacionesSocket(onNotificacion?: () => void) {
  const callbackRef = useRef(onNotificacion);
  callbackRef.current = onNotificacion;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("identificar", { token });
    });

    socket.on("notificacionPasajero", () => {
      callbackRef.current?.();
    });

    socket.on("disconnect", () => {
      console.log("Socket desconectado");
    });

    return () => {
      socket.disconnect();
    };
  }, []);
}