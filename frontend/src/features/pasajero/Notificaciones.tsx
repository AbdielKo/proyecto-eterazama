import { useEffect, useState } from "react";
import { obtenerNotificaciones, marcarNotificacionLeida, marcarTodasLeidas } from "../../api/pasajero.api";
import type { NotificacionPasajero } from "./pasajero.types";
import { Bell, CheckCheck, Ticket, RotateCcw, CheckCircle, Car } from "lucide-react";

const iconoMap: Record<string, typeof Bell> = {
  compra: Ticket,
  cancelacion: RotateCcw,
  reembolso: CheckCircle,
  transferencia: Car,
  default: Bell,
};

export default function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState<NotificacionPasajero[]>([]);
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    try {
      const data = await obtenerNotificaciones();
      setNotificaciones(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleMarcarLeida(id: string) {
    try {
      await marcarNotificacionLeida(id);
      setNotificaciones((prev) =>
        prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function handleMarcarTodas() {
    try {
      await marcarTodasLeidas();
      setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
    } catch (e) {
      console.error(e);
    }
  }

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notificaciones</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {noLeidas > 0 ? `${noLeidas} sin leer` : "Todo al día"}
          </p>
        </div>
        {noLeidas > 0 && (
          <button
            onClick={handleMarcarTodas}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {cargando ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <p className="text-gray-500">Cargando...</p>
        </div>
      ) : notificaciones.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Bell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No tienes notificaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notificaciones.map((n) => {
            const Icon = iconoMap[n.tipo] || iconoMap.default;
            return (
              <div
                key={n.id}
                onClick={() => !n.leida && handleMarcarLeida(n.id)}
                className={`bg-gray-900 border rounded-2xl p-4 flex items-start gap-4 transition-colors ${
                  n.leida ? "border-gray-800 opacity-60" : "border-gray-700 cursor-pointer hover:border-gray-600"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  n.leida ? "bg-gray-800" : "bg-sky-400/10"
                }`}>
                  <Icon className={`w-5 h-5 ${n.leida ? "text-gray-500" : "text-sky-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-medium ${n.leida ? "text-gray-400" : "text-white"}`}>{n.titulo}</p>
                    {!n.leida && <span className="w-2 h-2 bg-sky-400 rounded-full shrink-0" />}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{n.mensaje}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {n.fechaCreacion ? new Date(n.fechaCreacion).toLocaleString() : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}