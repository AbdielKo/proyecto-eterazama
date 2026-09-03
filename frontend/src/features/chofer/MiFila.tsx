import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { obtenerMiFila, anotarseEnFila, salirDeFila } from "./chofer.api";
import type { MiFila, VehiculoFila } from "./chofer.types";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import { Users, MapPin, LogIn, CheckCircle, AlertTriangle, LogOut, Clock } from "lucide-react";

function formatHora(fecha: string | null) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}

function estadoBadge(estado: string) {
  const colores: Record<string, string> = {
    activo: "bg-emerald-400/10 text-emerald-400",
    en_ruta: "bg-sky-400/10 text-sky-400",
    fin_de_ruta: "bg-purple-400/10 text-purple-400",
    mantenimiento: "bg-amber-400/10 text-amber-400",
    inactivo: "bg-red-400/10 text-red-400",
  };
  const etiquetas: Record<string, string> = {
    activo: "Activo",
    en_ruta: "En ruta",
    fin_de_ruta: "Fin de ruta",
    mantenimiento: "Mantenimiento",
    inactivo: "Inactivo",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colores[estado] || "bg-gray-400/10 text-gray-400"}`}>
      {etiquetas[estado] || estado}
    </span>
  );
}

function FilaVehiculo({ v, esMio }: { v: VehiculoFila; esMio?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
      esMio ? "bg-sky-600/20 border border-sky-500/30" : "bg-gray-800/40"
    }`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
        esMio ? "bg-sky-500 text-white" : "bg-gray-700 text-gray-300"
      }`}>
        {v.puestoFila}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${esMio ? "text-sky-400" : "text-white"}`}>
            {v.placa} {esMio && "(Tu)"}
          </p>
          {estadoBadge(v.estado)}
        </div>
        <p className="text-xs text-gray-500 truncate">{v.choferNombre} - {v.tipoVehiculo} {v.color && `- ${v.color}`}</p>
        <p className="text-[10px] text-gray-600 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" /> Ingreso: {formatHora(v.horaIngresoFila)}
        </p>
      </div>
    </div>
  );
}

function ColumnaFila({ titulo, iconColor, vehiculos, miPlaca }: { titulo: string; iconColor: string; vehiculos: VehiculoFila[]; miPlaca: string | null }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className={`w-4 h-4 ${iconColor}`} />
        <h3 className="text-sm font-semibold text-white">{titulo}</h3>
        <span className="ml-auto bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{vehiculos.length}</span>
      </div>
      {vehiculos.length === 0 ? (
        <p className="text-gray-500 text-xs py-4 text-center">Fila vacia</p>
      ) : (
        <div className="space-y-1.5">
          {vehiculos.map(v => <FilaVehiculo key={v.placa} v={v} esMio={miPlaca === v.placa} />)}
        </div>
      )}
    </div>
  );
}

export default function MiFila() {
  const { usuario } = useAuth();
  const [fila, setFila] = useState<MiFila | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  function cargar() {
    obtenerMiFila().then(setFila).catch(console.error);
  }

  useFlotaSocket(cargar);

  useEffect(() => {
    cargar();
  }, []);

  async function handleAnotarse(parada: string) {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await anotarseEnFila(parada);
      setMensaje({ tipo: "ok", texto: res.mensaje });
      cargar();
    } catch (e: any) {
      setMensaje({ tipo: "error", texto: e?.response?.data?.message || "Error al anotarse en la fila" });
    } finally {
      setEnviando(false);
    }
  }

  async function handleSalirDeFila() {
    if (!confirm("¿Deseas salir de la fila?")) return;
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await salirDeFila();
      setMensaje({ tipo: "ok", texto: res.mensaje });
      cargar();
    } catch (e: any) {
      setMensaje({ tipo: "error", texto: e?.response?.data?.message || "Error al salir de la fila" });
    } finally {
      setEnviando(false);
    }
  }

  if (!fila) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Mi fila</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">Cargando las filas...</p>
        </div>
      </div>
    );
  }

  const paradaLabel = fila.paradaActual === "eterazama" ? "Eterazama" : fila.paradaActual === "cochabamba" ? "Cochabamba" : fila.paradaActual === "en_ruta" ? "En ruta" : "Fuera de fila";

  const puedeAnotarse = fila.estadoVehiculo === "activo" && fila.estadoViaje !== "mantenimiento" && fila.estadoViaje !== "en_ruta";
  const bloqueoInactivo = fila.estadoVehiculo === "inactivo";
  const bloqueoMantenimiento = fila.estadoViaje === "mantenimiento";
  const bloqueoEnRuta = fila.estadoViaje === "en_ruta";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Mi fila</h1>
        <p className="text-gray-400 mt-1">Mira todas las filas y anotate en una sola parada</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm text-gray-400">Tu estado en fila</p>
            {fila.yaRegistrado ? (
              <p className="text-white font-medium mt-1">
                Estas anotado en <span className="text-sky-400 capitalize">{paradaLabel}</span> - puesto #{fila.miPuesto}
              </p>
            ) : fila.paradaActual === "en_ruta" || fila.paradaActual === "fuera_de_fila" ? (
              <p className="text-amber-400 font-medium mt-1">
                Tu vehiculo esta {fila.paradaActual === "en_ruta" ? "en ruta" : "fuera de fila"}. Anotate cuando termines.
              </p>
            ) : (
              <p className="text-gray-500 font-medium mt-1">Aun no estas anotado en ninguna fila</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAnotarse("cochabamba")}
              disabled={enviando || fila.paradaActual === "cochabamba" || !puedeAnotarse}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {fila.paradaActual === "cochabamba" ? <CheckCircle className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              Anotarme en Cochabamba
            </button>
            <button
              onClick={() => handleAnotarse("eterazama")}
              disabled={enviando || fila.paradaActual === "eterazama" || !puedeAnotarse}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {fila.paradaActual === "eterazama" ? <CheckCircle className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              Anotarme en Eterazama
            </button>
            {fila.yaRegistrado && (
              <button
                onClick={handleSalirDeFila}
                disabled={enviando}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Salir de la fila
              </button>
            )}
          </div>
        </div>
        {(bloqueoInactivo || bloqueoMantenimiento || bloqueoEnRuta) && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {bloqueoInactivo
              ? "Tu trufi esta INACTIVO. No puedes anotarte en ninguna fila hasta activarlo."
              : bloqueoMantenimiento
                ? "Tu trufi esta en MANTENIMIENTO. No puedes anotarte en ninguna fila."
                : "Tu trufi esta EN RUTA. No puedes anotarte en una fila hasta terminar el recorrido."}
          </div>
        )}
        {fila.yaRegistrado && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Solo puedes estar anotado en una parada a la vez. Sal de la fila actual para cambiarte de parada.
          </div>
        )}
        {mensaje && (
          <div className={`mt-3 text-sm rounded-lg px-3 py-2 ${mensaje.tipo === "error" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
            {mensaje.texto}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ColumnaFila titulo="Cochabamba" iconColor="text-emerald-400" vehiculos={fila.cochabamba} miPlaca={usuario?.placaAsignada || null} />
        <ColumnaFila titulo="Eterazama" iconColor="text-amber-400" vehiculos={fila.eterazama} miPlaca={usuario?.placaAsignada || null} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ColumnaFila titulo="En ruta" iconColor="text-purple-400" vehiculos={fila.enRuta} miPlaca={usuario?.placaAsignada || null} />
        <ColumnaFila titulo="Fuera de fila" iconColor="text-red-400" vehiculos={fila.fueraDeFila} miPlaca={usuario?.placaAsignada || null} />
      </div>
    </div>
  );
}
