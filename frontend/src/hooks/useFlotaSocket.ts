import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:3000";

export function useFlotaSocket(onActualizacion?: () => void) {
  const callbackRef = useRef(onActualizacion);
  callbackRef.current = onActualizacion;

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("Socket conectado");
    });

    socket.on("flotaActualizada", () => {
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
