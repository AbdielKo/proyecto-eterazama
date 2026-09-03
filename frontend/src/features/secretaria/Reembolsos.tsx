import { useCallback, useEffect, useState } from "react";
import {
  obtenerReembolsosSecretaria,
  confirmarReembolsoSecretaria,
} from "../../api/secretaria.api";
import type { Pasaje } from "../../types/pasaje";
import {
  Undo2,
  RotateCcw,
  Banknote,
  CheckCircle,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Ticket,
} from "lucide-react";

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

function codigoDe(p: Pasaje): string {
  return p.codigo || p.id.substring(0, 8).toUpperCase();
}

export default function Reembolsos() {
  const [reembolsos, setReembolsos] = useState<Pasaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [cargandoId, setCargandoId] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  const cargar = useCallback(async () => {
    try {
      const data = await obtenerReembolsosSecretaria();
      setReembolsos(data);
      setError("");
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const pendientes = reembolsos.filter((p) => p.estadoReembolso === "PENDIENTE");
  const reembolsados = reembolsos.filter((p) => p.estadoReembolso === "REEMBOLSADO");

  async function confirmar(p: Pasaje) {
    if (p.puedeReembolsar === false) {
      setError("Este reembolso está bloqueado: el vehículo se encuentra EN RUTA.");
      return;
    }
    const motivo = (motivos[p.id] || "").trim();
    const monto = Number(p.montoTotal || 0).toFixed(2);

    const confirmacion = motivo
      ? `¿Confirmar reembolso de Bs ${monto} al pasaje ${codigoDe(p)}?\nMotivo: ${motivo}`
      : `¿Confirmar reembolso de Bs ${monto} al pasaje ${codigoDe(p)}?`;
    if (!window.confirm(confirmacion)) return;

    setError("");
    setExito("");
    setCargandoId(p.id);
    try {
      await confirmarReembolsoSecretaria(p.id, motivo);
      setExito(`Reembolso confirmado: ${codigoDe(p)} (Bs ${monto}). Asiento liberado.`);
      setMotivos((prev) => {
        const copia = { ...prev };
        delete copia[p.id];
        return copia;
      });
      await cargar();
    } catch (e) {
      setError(mensajeError(e));
      await cargar();
    } finally {
      setCargandoId(null);
    }
  }

  function Tarjeta({ p }: { p: Pasaje }) {
    const esPendiente = p.estadoReembolso === "PENDIENTE";
    return (
      <div
        className={`rounded-2xl p-5 space-y-4 transition-shadow ${
          esPendiente
            ? "bg-gradient-to-br from-sky-950/90 to-gray-900 border border-sky-500/30 shadow-lg shadow-sky-900/20"
            : "bg-gradient-to-br from-emerald-950/80 to-gray-900 border border-emerald-500/25 shadow-lg shadow-emerald-900/10"
        }`}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sky-400 font-mono font-bold text-sm">{codigoDe(p)}</span>
              <span
                className={`text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide ${
                  esPendiente
                    ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                {esPendiente ? "PENDIENTE DE REEMBOLSO" : "REEMBOLSADO"}
              </span>
            </div>
            <p className="text-sm text-gray-200">
              {p.origen || p.tramo} <span className="text-sky-500/70">→</span> {p.destino || p.tramo}
            </p>
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            <p className="text-lg font-bold text-emerald-400">Bs {Number(p.montoTotal || 0).toFixed(2)}</p>
            <p className="text-[10px] text-slate-500">
              {p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleString() : ""}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Pasajero</p>
            <p className="text-white truncate font-medium">{p.pasajeroNombre || "-"}</p>
            {p.pasajeros && p.pasajeros.length > 1 && (
              <p className="text-slate-400 text-[10px] truncate">
                {p.pasajeros.map((x) => x.nombre).join(", ")}
              </p>
            )}
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Placa</p>
            <p className="text-sky-400 font-mono font-semibold">{p.placaVehiculo}</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-2.5">
            <p className="text-[9px] text-slate-400 uppercase tracking-wider">Asientos</p>
            <p className="text-white font-medium">{p.asientos?.join(", ")}</p>
          </div>
        </div>

        {!esPendiente && (
          <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Monto reembolsado</span>
              <span className="text-emerald-400 font-semibold">
                Bs {Number(p.montoReembolsado ?? p.montoTotal ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Confirmado por</span>
              <span className="text-white">{p.secretariaReembolso || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fecha del reembolso</span>
              <span className="text-slate-300">
                {p.fechaReembolso ? new Date(p.fechaReembolso).toLocaleString() : "-"}
              </span>
            </div>
            {p.motivoCancelacion && (
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 shrink-0">Motivo</span>
                <span className="text-slate-300 text-right">{p.motivoCancelacion}</span>
              </div>
            )}
          </div>
        )}

        {esPendiente && (
          <div className="space-y-3">
            {p.puedeReembolsar === false && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/40 text-red-300 rounded-lg px-3 py-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                El vehículo está <span className="font-bold">EN RUTA</span> (estado del viaje). Este reembolso
                está bloqueado en el sistema. No podrá procesarse hasta que el viaje termine.
              </div>
            )}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1 font-medium">Motivo de cancelación</label>
              <input
                value={motivos[p.id] ?? p.motivoCancelacion ?? ""}
                onChange={(e) =>
                  setMotivos((prev) => ({ ...prev, [p.id]: e.target.value }))
                }
                placeholder="Ej. El pasajero no viajará"
                className="w-full bg-slate-800/70 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => confirmar(p)}
              disabled={cargandoId === p.id || p.puedeReembolsar === false}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-bold shadow-lg shadow-sky-900/40 transition-all hover:shadow-sky-700/50 cursor-pointer"
            >
              {cargandoId === p.id ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Procesando reembolso...
                </>
              ) : p.puedeReembolsar === false ? (
                <>
                  <AlertTriangle className="w-4 h-4" /> Reembolso bloqueado (vehículo EN RUTA)
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" /> Confirmar reembolso y liberar asiento
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400/80" />
              La confirmación libera el asiento y descuenta el monto de Caja de forma automática.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl py-16 text-center">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin mx-auto mb-2" />
        <p className="text-slate-400 text-sm">Cargando reembolsos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Undo2 className="w-6 h-6 text-sky-400" /> Reembolsos
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Solicitudes de cancelación de pasajeros. Solo la Secretaría confirma el reembolso manualmente.
        </p>
      </div>

      {exito && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> {exito}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="flex items-center gap-2 bg-slate-900/70 border border-amber-500/20 rounded-xl px-4 py-3 w-fit">
        <Banknote className="w-4 h-4 text-amber-400" />
        <p className="text-sm text-slate-300">
          <span className="text-amber-400 font-bold text-base">{pendientes.length}</span> solicitud
          {pendientes.length !== 1 ? "es" : ""} pendiente
          {pendientes.length !== 1 ? "s" : ""}
        </p>
      </div>

      {pendientes.length === 0 && reembolsados.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl py-16 text-center">
          <RotateCcw className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No hay reembolsos registrados</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <h2 className="font-bold text-amber-300 flex items-center gap-2 uppercase tracking-wide text-sm">
                <AlertTriangle className="w-4 h-4" /> Pendientes de reembolso
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
                {pendientes.length}
              </span>
            </div>
            {pendientes.length === 0 ? (
              <p className="text-sm text-slate-500">Sin solicitudes pendientes</p>
            ) : (
              pendientes.map((p) => <Tarjeta key={p.id} p={p} />)
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <h2 className="font-bold text-emerald-300 flex items-center gap-2 uppercase tracking-wide text-sm">
                <CheckCircle className="w-4 h-4" /> Reembolsados
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                {reembolsados.length}
              </span>
            </div>
            {reembolsados.length === 0 ? (
              <p className="text-sm text-slate-500">Sin pasajes reembolsados</p>
            ) : (
              reembolsados.map((p) => <Tarjeta key={p.id} p={p} />)
            )}
          </div>
        </div>
      )}

      <div className="bg-slate-900/80 border border-sky-500/20 rounded-2xl p-4 text-xs text-slate-400 space-y-1">
        <p className="flex items-center gap-1.5 font-semibold text-sky-300">
          <Ticket className="w-3.5 h-3.5 text-sky-400" /> Reglas del sistema:
        </p>
        <p>· El pasajero solo puede solicitar la cancelación; nunca libera el asiento por su cuenta.</p>
        <p>· Al confirmar, el pasaje pasa a REEMBOLSADO y el asiento vuelve a estar disponible para venta.</p>
        <p>· El historial conserva la venta original con su monto, marcada como reembolsada.</p>
        <p>· No se permite reembolsar el mismo pasaje dos veces.</p>
      </div>
    </div>
  );
}