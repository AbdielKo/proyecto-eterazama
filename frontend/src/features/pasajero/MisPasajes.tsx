import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { obtenerPasajes, solicitarCancelacion } from "../../api/pasajes.api";
import type { Pasaje } from "../../types/pasaje";
import { Wallet, MapPin, AlertTriangle, Loader2, RotateCcw } from "lucide-react";

function mensajeError(e: unknown): string {
  const error = e as {
    response?: {
      data?: {
        message?: string | string[];
      };
    };
  };
  const mensaje = error?.response?.data?.message;
  if (Array.isArray(mensaje)) return mensaje[0] || "Error de conexión";
  return mensaje || "Error de conexión";
}

export default function MisPasajes() {
  const { usuario } = useAuth();
  const [pasajes, setPasajes] = useState<Pasaje[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "activos" | "cancelados">("todos");
  const [cargando, setCargando] = useState(true);
  const [cargandoCancelacion, setCargandoCancelacion] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function cargar() {
    try {
      const nombre = (usuario?.nombre || usuario?.nombreUsuario || "").toLowerCase();
      const p = await obtenerPasajes();
      setPasajes(p.filter((pas: Pasaje) => pas.pasajeroNombre?.toLowerCase().includes(nombre)));
      setError("");
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  useEffect(() => {
    cargar().finally(() => setCargando(false));
  }, [usuario]);

  async function cancelar(p: Pasaje) {
    const motivo = window.prompt(
      "Motivo de cancelación (opcional). La Secretaría revisará tu solicitud para confirmar el reembolso."
    );
    if (motivo === null) return;

    setError("");
    setCargandoCancelacion(p.id);
    try {
      await solicitarCancelacion(p.id, motivo);
      await cargar();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargandoCancelacion(null);
    }
  }

  const filtrados = pasajes.filter((p) => {
    if (filtro === "activos") return p.estado !== "cancelado";
    if (filtro === "cancelados") return p.estado === "cancelado";
    return true;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Mis Pasajes</h1>
        <p className="text-gray-400 text-sm mt-0.5">Tus viajes y pasajes activos</p>
      </div>

      <div className="flex gap-2">
        {(["todos", "activos", "cancelados"] as const).map((f) => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer capitalize ${filtro === f ? "bg-sky-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
            {f}
          </button>
        ))}
      </div>

      <p className="text-sm text-gray-400">{filtrados.length} pasajes</p>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {cargando ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center"><p className="text-gray-500">Cargando...</p></div>
      ) : filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Wallet className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500">No tienes pasajes {filtro === "todos" ? "" : filtro}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((p) => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sky-400 font-mono font-bold">{p.placaVehiculo}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      p.estado === "cancelado" ? "bg-red-400/10 text-red-400" : "bg-emerald-400/10 text-emerald-400"
                    }`}>{p.estado || "activo"}</span>
                    {p.estadoReembolso === "PENDIENTE" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400">
                        REEMBOLSO PENDIENTE
                      </span>
                    )}
                    {p.estadoReembolso === "REEMBOLSADO" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-400/10 text-red-400">
                        REEMBOLSADO
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-white flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" /> {p.tramo}
                  </p>
                  <p className="text-xs text-gray-400">Asientos: {p.asientos?.join(", ")}</p>
                  {p.pasajeroNombre && <p className="text-xs text-gray-500">Pasajero: {p.pasajeroNombre}</p>}
                  {p.estadoReembolso === "PENDIENTE" && p.motivoCancelacion && (
                    <p className="text-xs text-amber-400/80">Motivo: {p.motivoCancelacion}</p>
                  )}
                </div>
                <div className="text-right space-y-1">
                  <p className="text-lg font-bold text-green-400">Bs {p.montoTotal}</p>
                  <p className="text-[10px] text-gray-500">{p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleDateString() : ""}</p>
                </div>
              </div>
              {p.estado !== "cancelado" && !p.estadoReembolso && (
                <button
                  onClick={() => cancelar(p)}
                  disabled={cargandoCancelacion === p.id}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-red-600/20 disabled:bg-gray-800 disabled:cursor-not-allowed border border-gray-700 hover:border-red-500/40 text-gray-300 hover:text-red-400 px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  {cargandoCancelacion === p.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Solicitando...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" /> Solicitar cancelación y reembolso
                    </>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
