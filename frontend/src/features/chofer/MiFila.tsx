import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { obtenerMiFila, anotarseEnFila, salirDeFila, solicitarRetiroFila, obtenerMiSolicitudRetiro, programarSalida } from "./chofer.api";
import type { MiFila, VehiculoFila, SolicitudRetiro } from "./chofer.types";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import { Users, MapPin, LogIn, CheckCircle, AlertTriangle, LogOut, Clock, FileText, XCircle, CheckCircle2, Timer } from "lucide-react";

function formatHora(fecha: string | null) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}

// Cuenta regresiva real del estado POR SALIR: salidaProgramada está persistida
// en PostgreSQL (nunca se pierde al cerrar la app); esto solo la visualiza.
function useTemporizador(salida: string | null | undefined) {
  const [restante, setRestante] = useState<number>(0);
  useEffect(() => {
    if (!salida) return;
    setRestante(Math.max(0, new Date(salida).getTime() - Date.now()));
    const id = setInterval(() => {
      setRestante(Math.max(0, new Date(salida).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [salida]);
  const mins = Math.floor(restante / 60000);
  const segs = Math.floor((restante % 60000) / 1000);
  return { mins, segs, terminado: restante <= 0 };
}

function TemporizadorSalida({ salida, placa }: { salida: string | null | undefined; placa: string }) {
  const { mins, segs, terminado } = useTemporizador(salida);
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
      <Timer className="w-3.5 h-3.5" />
      {terminado ? (
        <span>({placa}) partiendo...</span>
      ) : (
        <span>({placa}) sale en {String(mins).padStart(2, "0")}:{String(segs).padStart(2, "0")}</span>
      )}
    </div>
  );
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
        <p className="text-[10px] text-gray-600 flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Users className="w-2.5 h-2.5" /> {v.pasajeros ?? 0} pasajero{v.pasajeros === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> Ingreso: {formatHora(v.horaIngresoFila)}
          </span>
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
  const [solicitud, setSolicitud] = useState<SolicitudRetiro | null>(null);

  function cargar() {
    obtenerMiFila().then(setFila).catch(console.error);
    obtenerMiSolicitudRetiro().then(setSolicitud).catch(console.error);
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

  async function handleSolicitarRetiro() {
    const motivo = prompt("Indica el motivo de tu retiro de la fila:");
    if (motivo === null) return;
    if (!motivo.trim()) {
      setMensaje({ tipo: "error", texto: "Debes indicar el motivo del retiro." });
      return;
    }
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await solicitarRetiroFila(motivo.trim());
      setMensaje({ tipo: "ok", texto: res.mensaje });
      cargar();
    } catch (e: any) {
      setMensaje({ tipo: "error", texto: e?.response?.data?.message || "Error al solicitar el retiro" });
    } finally {
      setEnviando(false);
    }
  }

  async function handleProgramarSalida() {
    if (!confirm("¿Programar la salida de tu vehículo? Partirá en 10 minutos.")) return;
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await programarSalida();
      setMensaje({ tipo: "ok", texto: res.mensaje });
      cargar();
    } catch (e: any) {
      setMensaje({ tipo: "error", texto: e?.response?.data?.message || "Error al programar la salida" });
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
  const miPlaca = usuario?.placaAsignada || null;

  const puedeAnotarse = fila.estadoVehiculo === "activo" && fila.estadoViaje !== "mantenimiento" && fila.estadoViaje !== "en_ruta" && fila.estadoViaje !== "por_salir";
  const bloqueoInactivo = fila.estadoVehiculo === "inactivo";
  const bloqueoMantenimiento = fila.estadoViaje === "mantenimiento";
  const bloqueoEnRuta = fila.estadoViaje === "en_ruta";
  const enPorSalir = fila.estadoViaje === "por_salir";

  // Nueva semántica: paradaActual es la UBICACIÓN (sector) del chofer.
  // Estar ubicado en un sector NO implica estar anotado: anotarse es
  // voluntario y solo se permite si el sector coincide con la ubicación.
  const anotadoCochabamba = fila.paradaActual === "cochabamba" && fila.yaRegistrado;
  const anotadoEterazama = fila.paradaActual === "eterazama" && fila.yaRegistrado;
  const botonCochabambaBloqueado = !puedeAnotarse || anotadoCochabamba || fila.paradaActual === "eterazama";
  const botonEterazamaBloqueado = !puedeAnotarse || anotadoEterazama || fila.paradaActual === "cochabamba";

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
              disabled={enviando || botonCochabambaBloqueado}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {anotadoCochabamba ? <CheckCircle className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              {anotadoCochabamba ? `Estas en Cochabamba #${fila.miPuesto}` : "Anotarme en Cochabamba"}
            </button>
            <button
              onClick={() => handleAnotarse("eterazama")}
              disabled={enviando || botonEterazamaBloqueado}
              className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {anotadoEterazama ? <CheckCircle className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
              {anotadoEterazama ? `Estas en Eterazama #${fila.miPuesto}` : "Anotarme en Eterazama"}
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
            {fila.yaRegistrado && fila.miPuesto === 1 && (
              <button
                onClick={handleProgramarSalida}
                disabled={enviando}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                <Timer className="w-4 h-4" />
                Programar salida
              </button>
            )}
            {fila.yaRegistrado && fila.miPuesto === 1 && (
              <button
                onClick={handleSolicitarRetiro}
                disabled={enviando || solicitud?.estado === "PENDIENTE"}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                {solicitud?.estado === "PENDIENTE" ? "Retiro en revisión" : "Solicitar retiro de la fila"}
              </button>
            )}
          </div>
        </div>
        {solicitud?.estado === "PENDIENTE" && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Tienes una solicitud de retiro PENDIENTE: "{solicitud.motivo}". Espera la aprobación de la secretaría.
          </div>
        )}
        {solicitud?.estado === "ACEPTADA" && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Tu solicitud de retiro fue APROBADA por la secretaría.
          </div>
        )}
        {solicitud?.estado === "RECHAZADA" && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            <XCircle className="w-3.5 h-3.5 shrink-0" />
            Tu solicitud de retiro fue RECHAZADA: {solicitud.comentarioRespuesta || solicitud.motivo}
          </div>
        )}
        {fila.yaRegistrado && fila.miPuesto === 1 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Eres el PRIMERO de la fila. Puedes cargar pasajeros y vender pasajes.
          </div>
        )}
        {enPorSalir && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            <Timer className="w-3.5 h-3.5 shrink-0" />
            <TemporizadorSalida salida={fila.salidaProgramada} placa={usuario?.placaAsignada || ""} />
          </div>
        )}
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

      {fila.porSalir.length > 0 && (
        <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Timer className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Por salir</h3>
            <span className="ml-auto bg-amber-500/10 text-amber-300 text-[10px] px-2 py-0.5 rounded-full">{fila.porSalir.length}</span>
          </div>
          {fila.porSalir.length === 0 ? (
            <p className="text-gray-500 text-xs py-4 text-center">Sin salidas programadas</p>
          ) : (
            <div className="space-y-1.5">
              {fila.porSalir.map(v => (
                <div key={v.placa} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-sm font-bold shrink-0">
                    <Timer className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-amber-300">
                      {v.placa} {miPlaca === v.placa && "(Tu)"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{v.choferNombre} - {v.tipoVehiculo} {v.color && `- ${v.color}`}</p>
                    <TemporizadorSalida salida={v.salidaProgramada} placa={v.placa} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ColumnaFila titulo="En ruta" iconColor="text-purple-400" vehiculos={fila.enRuta} miPlaca={usuario?.placaAsignada || null} />
        <ColumnaFila titulo="Fuera de fila" iconColor="text-red-400" vehiculos={fila.fueraDeFila} miPlaca={usuario?.placaAsignada || null} />
      </div>
    </div>
  );
}
