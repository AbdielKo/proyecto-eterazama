import { useEffect, useState } from "react";
import { obtenerMiVehiculo, cambiarEstadoVehiculo, cambiarEstadoViaje } from "./chofer.api";
import type { MiVehiculo } from "./chofer.types";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import { Truck, Flag, Wrench, Power, Car, AlertTriangle, X, CheckCircle } from "lucide-react";

// Estado UNICO del vehiculo. ACTIVO, EN RUTA, FINALIZO RUTA y MANTENIMIENTO
// son un solo estado sincronizado entre Chofer y Secretaria. Cada estado
// dispara la llamada al backend correspondiente.
const estados = [
  {
    key: "activo",
    label: "ACTIVO",
    icon: Power,
    color: "bg-emerald-600 hover:bg-emerald-700",
    desc: "Tu trufi queda listo y disponible para operar.",
  },
  {
    key: "en_ruta",
    label: "EN RUTA",
    icon: Truck,
    color: "bg-sky-600 hover:bg-sky-700",
    desc: "El vehiculo inicia su recorrido y sale de la fila.",
  },
  {
    key: "fin_de_ruta",
    label: "FINALIZO RUTA",
    icon: Flag,
    color: "bg-purple-600 hover:bg-purple-700",
    desc: "El vehiculo termina su recorrido y libera los asientos.",
  },
  {
    key: "mantenimiento",
    label: "MANTENIMIENTO",
    icon: Wrench,
    color: "bg-amber-600 hover:bg-amber-700",
    desc: "El vehiculo sale de operacion por mantenimiento.",
  },
];

function etiqueta(key: string) {
  const map: Record<string, string> = {
    activo: "Activo",
    en_ruta: "En ruta",
    fin_de_ruta: "Fin de la ruta",
    mantenimiento: "Mantenimiento",
    listo: "Listo",
  };
  return map[key] || key;
}

function badgeColor(estadoActual: string) {
  const colores: Record<string, string> = {
    activo: "bg-emerald-400/10 text-emerald-400",
    en_ruta: "bg-sky-400/10 text-sky-400",
    fin_de_ruta: "bg-purple-400/10 text-purple-400",
    mantenimiento: "bg-amber-400/10 text-amber-400",
  };
  return colores[estadoActual] || "bg-gray-400/10 text-gray-400";
}

// Deriva el estado unico actual a partir de los dos campos de la BD.
function estadoActual(v: MiVehiculo): string {
  if (v.estadoViaje === "mantenimiento") return "mantenimiento";
  if (v.estadoViaje === "en_ruta") return "en_ruta";
  if (v.estadoViaje === "fin_de_ruta") return "fin_de_ruta";
  return "activo";
}

export default function EstadoViaje() {
  const [vehiculo, setVehiculo] = useState<MiVehiculo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cambiando, setCambiando] = useState(false);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  function cargar() {
    obtenerMiVehiculo()
      .then(setVehiculo)
      .catch(() => setVehiculo(null))
      .finally(() => setCargando(false));
  }

  useFlotaSocket(cargar);

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (!notificacion) return;
    const t = setTimeout(() => setNotificacion(null), 4000);
    return () => clearTimeout(t);
  }, [notificacion]);

  async function ejecutarCambio(key: string) {
    setCambiando(true);
    setNotificacion(null);
    try {
      if (key === "activo") {
        await cambiarEstadoVehiculo("activo");
      } else {
        await cambiarEstadoViaje(key);
      }
      cargar();
      setNotificacion({ tipo: "ok", texto: `Estado actualizado correctamente a "${etiqueta(key)}".` });
    } catch (e: any) {
      setNotificacion({
        tipo: "error",
        texto: e?.response?.data?.message || "No se pudo actualizar el estado. Intenta nuevamente.",
      });
    } finally {
      setCambiando(false);
      setConfirmando(null);
    }
  }

  const actual = vehiculo ? estadoActual(vehiculo) : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Estado del Trufi</h1>
        <p className="text-gray-400 mt-1">Controla el estado de tu vehiculo: ACTIVO, EN RUTA, FINALIZO RUTA o MANTENIMIENTO</p>
      </div>

      {notificacion && (
        <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${
          notificacion.tipo === "ok" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"
        }`}>
          {notificacion.tipo === "ok" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {notificacion.texto}
        </div>
      )}

      {cargando ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <p className="text-gray-500">Cargando...</p>
        </div>
      ) : !vehiculo ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Car className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No tienes un vehiculo asignado.</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-semibold text-white">Estado actual</h3>
                <p className="text-sm text-gray-500 mt-1">Placa: <span className="text-sky-400 font-medium">{vehiculo.placa}</span></p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${badgeColor(actual)}`}>
                {etiqueta(actual)}
              </span>
            </div>
            {actual === "mantenimiento" && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl px-4 py-3 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Tu vehiculo esta en MANTENIMIENTO. No esta disponible para operar.
              </div>
            )}
            {actual === "en_ruta" && (
              <div className="flex items-center gap-2 bg-sky-500/10 border border-sky-500/30 text-sky-400 rounded-xl px-4 py-3 text-sm">
                <Truck className="w-4 h-4 shrink-0" />
                Tu vehiculo esta EN RUTA. Los reembolsos de pasajes quedan bloqueados hasta finalizar la ruta.
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-4">
              <div>
                <span className="text-gray-500">Parada: </span>
                <span className="text-white capitalize">{vehiculo.paradaActual}</span>
              </div>
              <div>
                <span className="text-gray-500">Puesto: </span>
                <span className="text-white">#{vehiculo.puestoFila ?? "-"}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white">Cambiar estado</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">
              El estado del vehiculo es unico y se sincroniza en tiempo real con Secretaria.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {estados.map((e) => {
                const Icon = e.icon;
                const esActual = actual === e.key;
                return (
                  <button
                    key={e.key}
                    onClick={() => setConfirmando(e.key)}
                    disabled={esActual || cambiando}
                    className={`text-left flex items-start gap-3 px-5 py-5 rounded-xl text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${e.color}`}
                  >
                    <Icon className="w-6 h-6 shrink-0" />
                    <div>
                      <p className="font-bold tracking-wide">{e.label}</p>
                      <p className="text-xs opacity-80 mt-0.5">{e.desc}</p>
                      {esActual && <span className="inline-block mt-1 text-xs opacity-75">(Estado actual)</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
            <p className="text-sm text-gray-500 text-center">
              Al finalizar la ruta se liberan automaticamente todos los asientos de pasajeros para el siguiente viaje.
              Los cambios se guardan en la base de datos y se muestran en tiempo real a Secretaria.
            </p>
          </div>
        </>
      )}

      {confirmando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Confirmar cambio</h3>
                <p className="text-sm text-gray-400 mt-1">
                  ¿Deseas cambiar el estado de tu vehiculo a{" "}
                  <span className="text-white font-medium">{etiqueta(confirmando)}</span>?
                </p>
              </div>
              <button onClick={() => setConfirmando(null)} className="ml-auto text-gray-500 hover:text-white cursor-pointer" title="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmando(null)}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                CANCELAR
              </button>
              <button
                onClick={() => ejecutarCambio(confirmando)}
                disabled={cambiando}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {cambiando ? "Guardando..." : "CONFIRMAR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
