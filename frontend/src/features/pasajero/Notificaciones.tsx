import { Bell, CheckCircle, Clock, AlertCircle, Info } from "lucide-react";

type Notificacion = {
  id: number;
  tipo: "compra" | "pago" | "horario" | "cancelacion" | "promocion";
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
};

const notificacionesEjemplo: Notificacion[] = [
  { id: 1, tipo: "compra", titulo: "Pasaje comprado", mensaje: "Tu pasaje para Cochabamba - Eterazama ha sido confirmado", fecha: "2026-08-26T10:30:00", leida: true },
  { id: 2, tipo: "pago", titulo: "Pago recibido", mensaje: "Se confirmo el pago de Bs 5 por tu pasaje", fecha: "2026-08-26T10:31:00", leida: true },
  { id: 3, tipo: "horario", titulo: "Cambio de horario", mensaje: "El trufi CB-1234 saldra 15 minutos antes del horario programado", fecha: "2026-08-25T18:00:00", leida: false },
  { id: 4, tipo: "promocion", titulo: "Nueva promocion", mensaje: "2x1 en pasajes de regreso los fines de semana", fecha: "2026-08-24T09:00:00", leida: false },
];

const iconoMap = {
  compra: CheckCircle,
  pago: CheckCircle,
  horario: Clock,
  cancelacion: AlertCircle,
  promocion: Info,
};

const colorMap = {
  compra: "text-emerald-400",
  pago: "text-sky-400",
  horario: "text-amber-400",
  cancelacion: "text-red-400",
  promocion: "text-purple-400",
};

export default function Notificaciones() {
  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Notificaciones</h1>
        <p className="text-gray-400 text-sm mt-0.5">Avisos y alertas de tus viajes</p>
      </div>

      {notificacionesEjemplo.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Bell className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500">Sin notificaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notificacionesEjemplo.map((n) => {
            const Icon = iconoMap[n.tipo];
            return (
              <div key={n.id} className={`bg-gray-900 border rounded-xl p-4 flex gap-3 transition-colors ${n.leida ? "border-gray-800" : "border-sky-800/50 bg-sky-950/20"}`}>
                <div className={`mt-0.5 shrink-0 ${colorMap[n.tipo]}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{n.titulo}</p>
                    {!n.leida && <span className="w-2 h-2 bg-sky-400 rounded-full shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{n.mensaje}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{new Date(n.fecha).toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
