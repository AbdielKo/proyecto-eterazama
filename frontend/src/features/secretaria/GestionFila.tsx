import { useEffect, useState } from "react";
import { obtenerVehiculos, trasladarVehiculo } from "../../api/flota.api";
import { obtenerSolicitudesRetiro, aprobarRetiro, rechazarRetiro, type SolicitudRetiro } from "../../api/secretaria.api";
import api from "../../api/axios";
import type { Vehiculo } from "../../types/vehiculo";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import { MapPin, ArrowRight, Send, FileText, CheckCircle2, XCircle, Timer, Wrench, PowerOff, Route } from "lucide-react";

// Cuenta regresiva real del estado POR SALIR (salidaProgramada viene de
// PostgreSQL; esto solo la visualiza en tiempo real).
function useTemporizadorSalida(salida: string | null | undefined) {
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
  return { mins, segs, termino: restante <= 0 };
}

function TemporizadorSalida({ salida }: { salida: string | null | undefined }) {
  const { mins, segs, termino } = useTemporizadorSalida(salida);
  if (!salida) return null;
  return (
    <span className="flex items-center gap-1 text-blue-300 text-xs">
      <Timer className="w-3 h-3" />
      {termino ? "partiendo..." : `sale en ${String(mins).padStart(2, "0")}:${String(segs).padStart(2, "0")}`}
    </span>
  );
}

// Etiqueta de estado del viaje para identificar claramente el estado operativo.
function EstadoViajeBadge({ v }: { v: Vehiculo }) {
  const mapa: Record<string, { label: string; color: string }> = {
    listo: { label: "EN ESPERA", color: "bg-gray-600/20 text-gray-300" },
    fin_de_ruta: { label: "FIN DE RUTA", color: "bg-purple-500/20 text-purple-300" },
    por_salir: { label: "POR SALIR", color: "bg-blue-500/20 text-blue-300" },
    en_ruta: { label: "EN RUTA", color: "bg-sky-500/20 text-sky-300" },
    mantenimiento: { label: "MANTENIMIENTO", color: "bg-amber-500/20 text-amber-300" },
  };
  const key = v.estadoViaje || "listo";
  const m = mapa[key] || { label: key, color: "bg-gray-600/20 text-gray-300" };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${m.color}`}>
      {m.label}
    </span>
  );
}

export default function GestionFila() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudRetiro[]>([]);
  const [procesando, setProcesando] = useState<string | null>(null);

  async function cargar() {
    try {
      const data = await obtenerVehiculos();
      setVehiculos(data);
    } catch (error) {
      console.error(error);
    }
    cargarSolicitudes();
  }

  async function cargarSolicitudes() {
    try {
      const data = await obtenerSolicitudesRetiro("PENDIENTE");
      setSolicitudes(data);
    } catch (error) {
      console.error(error);
    }
  }

  useFlotaSocket(cargar);

  useEffect(() => { cargar(); }, []);

  async function handleAprobar(id: string) {
    const comentario = prompt("Comentario (opcional) para la aprobación:") || undefined;
    setProcesando(id);
    try { await aprobarRetiro(id, comentario); cargar(); } catch (e: any) { console.error(e); alert(e?.response?.data?.message || "Error al aprobar"); } finally { setProcesando(null); }
  }

  async function handleRechazar(id: string) {
    const comentario = prompt("Motivo del rechazo:") || undefined;
    setProcesando(id);
    try { await rechazarRetiro(id, comentario); cargar(); } catch (e: any) { console.error(e); alert(e?.response?.data?.message || "Error al rechazar"); } finally { setProcesando(null); }
  }

  async function mover(id: number, parada: string) {
    try { await trasladarVehiculo(id, parada); cargar(); } catch (error) { console.error(error); }
  }

  async function reordenar(cambios: { id: number; puestoFila: number }[]) {
    try {
      await api.patch("/flota", { cambios });
      cargar();
    } catch (error) {
      console.error(error);
    }
  }

  function moverOrden(lista: Vehiculo[], index: number, dir: -1 | 1) {
    const destino = index + dir;
    if (destino < 0 || destino >= lista.length) return;
    const nueva = [...lista];
    [nueva[index], nueva[destino]] = [nueva[destino], nueva[index]];
    const cambios = nueva.map((v, i) => ({ id: v.id!, puestoFila: i + 1 }));
    reordenar(cambios);
  }

  // Separación por estados operativos reales (PROBLEMA 2 / 10).
  // Mismo criterio que el backend: no ocupan puesto numerado los vehículos
  // por_salir, en_ruta o mantenimiento (se muestran en sus propias secciones),
  // ni los vehículos solo UBICADOS en el sector pero NO anotados (puesto 0).
  const noOcupaPuesto = (v: Vehiculo) =>
    (v.puestoFila ?? 0) <= 0 ||
    v.estadoViaje === "por_salir" ||
    v.estadoViaje === "en_ruta" ||
    v.estadoViaje === "mantenimiento" ||
    v.paradaActual === "en_ruta";

  const cochabamba = vehiculos
    .filter((v) => v.paradaActual === "cochabamba" && !noOcupaPuesto(v))
    .sort((a, b) => (a.puestoFila || 0) - (b.puestoFila || 0));
  const eterazama = vehiculos
    .filter((v) => v.paradaActual === "eterazama" && !noOcupaPuesto(v))
    .sort((a, b) => (a.puestoFila || 0) - (b.puestoFila || 0));
  const porSalir = vehiculos.filter((v) => v.estadoViaje === "por_salir");
  const enRuta = vehiculos.filter(
    (v) => v.estadoViaje === "en_ruta" || v.paradaActual === "en_ruta"
  );
  const mantenimiento = vehiculos.filter((v) => v.estadoViaje === "mantenimiento");
  // Fuera de servicio: no en ruta y no en mantenimiento y en fuera_de_fila
  const fuera = vehiculos.filter(
    (v) =>
      v.paradaActual === "fuera_de_fila" &&
      v.estadoViaje !== "en_ruta" &&
      v.estadoViaje !== "mantenimiento"
  );

  // Render de una lista simple de vehículos con su puesto y acciones.
  function renderListaVeh(titulo: string, color: string, lista: Vehiculo[]) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className={`w-4 h-4 ${color}`} />
          <h2 className="text-sm font-semibold text-white">{titulo}</h2>
          <span className="ml-auto bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{lista.length} vehículo{lista.length !== 1 ? "s" : ""}</span>
        </div>
        {lista.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">Sin vehículos</p>
        ) : (
          <div className="space-y-2">
            {lista.map((v, index) => (
              <div key={v.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">#{v.puestoFila ?? "-"}</span>
                    <span className="font-semibold text-sky-400 text-sm">{v.placa}</span>
                    <EstadoViajeBadge v={v} />
                    {(v.pasajeros ?? 0) > 0 && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
                        {v.pasajeros} pasajero{v.pasajeros === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{v.choferNombre}</p>
                </div>
                <div className="flex gap-1 shrink-0 items-center">
                  <button onClick={() => moverOrden(lista, index, -1)} className="p-1.5 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer" title="Subir">↑</button>
                  <button onClick={() => moverOrden(lista, index, 1)} className="p-1.5 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer" title="Bajar">↓</button>
                  <button
                    onClick={() => v.id !== undefined && mover(v.id, "eterazama")}
                    className="p-1.5 bg-sky-600/20 text-sky-400 rounded-lg hover:bg-sky-600/30 transition-colors cursor-pointer"
                    title="Enviar Eterazama"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => v.id !== undefined && mover(v.id, "fuera_de_fila")}
                    className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors cursor-pointer"
                    title="Fuera de servicio"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // EN RUTA: muestra placa, chofer, origen/destino, hora salida y pasajeros actuales.
  function renderEnRuta() {
    return (
      <div className="bg-gray-900 border border-sky-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Route className="w-4 h-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-white">EN RUTA</h2>
          <span className="ml-auto bg-sky-500/10 text-sky-300 text-[10px] px-2 py-0.5 rounded-full">{enRuta.length} vehículo{enRuta.length !== 1 ? "s" : ""}</span>
        </div>
        {enRuta.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">Sin vehículos en ruta</p>
        ) : (
          <div className="space-y-2">
            {enRuta.map((v) => (
              <div key={v.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sky-400 text-sm">{v.placa}</span>
                    <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded">EN RUTA</span>
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">
                      {v.pasajeros ?? 0} pasajero{v.pasajeros === 1 ? "" : "s"} actual{v.pasajeros === 1 ? "" : "es"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{v.choferNombre}</p>
                  {v.viajeActual && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {v.viajeActual.origen || "—"} → {v.viajeActual.destino || "—"}
                      {v.viajeActual.horaSalida ? ` · Salida ${v.viajeActual.horaSalida}` : ""}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // MANTENIMIENTO
  function renderMantenimiento() {
    return (
      <div className="bg-gray-900 border border-amber-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">MANTENIMIENTO</h2>
          <span className="ml-auto bg-amber-500/10 text-amber-300 text-[10px] px-2 py-0.5 rounded-full">{mantenimiento.length} vehículo{mantenimiento.length !== 1 ? "s" : ""}</span>
        </div>
        {mantenimiento.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">Sin vehículos en mantenimiento</p>
        ) : (
          <div className="space-y-2">
            {mantenimiento.map((v) => (
              <div key={v.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-300 text-sm">{v.placa}</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">MANTENIMIENTO</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{v.choferNombre}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // FUERA DE SERVICIO
  function renderFuera() {
    return (
      <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <PowerOff className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-semibold text-white">FUERA DE SERVICIO</h2>
          <span className="ml-auto bg-red-500/10 text-red-300 text-[10px] px-2 py-0.5 rounded-full">{fuera.length} vehículo{fuera.length !== 1 ? "s" : ""}</span>
        </div>
        {fuera.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">Sin vehículos fuera de servicio</p>
        ) : (
          <div className="space-y-2">
            {fuera.map((v) => (
              <div key={v.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-300 text-sm">{v.placa}</span>
                    <span className="text-[10px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">FUERA DE SERVICIO</span>
                    <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                      {v.pasajeros ?? 0} pasajero{v.pasajeros === 1 ? "" : "s"} actual{v.pasajeros === 1 ? "" : "es"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{v.choferNombre}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // POR SALIR
  function renderPorSalir() {
    return (
      <div className="bg-gray-900 border border-blue-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Timer className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">POR SALIR</h2>
          <span className="ml-auto bg-blue-500/10 text-blue-300 text-[10px] px-2 py-0.5 rounded-full">{porSalir.length} vehículo{porSalir.length !== 1 ? "s" : ""}</span>
        </div>
        {porSalir.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">Sin vehículos por salir</p>
        ) : (
          <div className="space-y-2">
            {porSalir.map((v) => (
              <div key={v.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase">{v.paradaActual === "cochabamba" ? "Cochabamba" : v.paradaActual === "eterazama" ? "Eterazama" : "—"}</span>
                    <span className="font-semibold text-sky-400 text-sm">{v.placa}</span>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">POR SALIR</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{v.choferNombre}</p>
                </div>
                <div className="shrink-0">
                  <TemporizadorSalida salida={v.salidaProgramada} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Filas y Paradas</h1>
        <p className="text-gray-400 text-sm mt-0.5">Controla el orden de salida y paradas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderListaVeh("Cochabamba", "text-emerald-400", cochabamba)}
        {renderListaVeh("Eterazama", "text-amber-400", eterazama)}
      </div>

      {renderPorSalir()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderEnRuta()}
        {renderMantenimiento()}
        {renderFuera()}
      </div>

      {/* Solicitudes de retiro voluntario de la fila */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">Solicitudes de retiro de la fila</h2>
          <span className="ml-auto bg-orange-500/10 text-orange-400 text-[10px] px-2 py-0.5 rounded-full">{solicitudes.length} pendiente{solicitudes.length !== 1 ? "s" : ""}</span>
        </div>

        {solicitudes.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">No hay solicitudes de retiro pendientes</p>
        ) : (
          <div className="space-y-2">
            {solicitudes.map((s) => (
              <div key={s.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">#{s.puestoFila}</span>
                    <span className="font-semibold text-sky-400 text-sm">{s.placa}</span>
                    <span className="text-[10px] bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded capitalize">{(s.parada === "cochabamba" ? "Cochabamba" : "Eterazama")}</span>
                    {s.tienePasajeros && (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">{s.cantidadAsientos} asiento{s.cantidadAsientos !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">
                    {s.choferNombre} - {s.motivo || "Sin motivo indicado"}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0 items-center">
                  <button
                    onClick={() => handleAprobar(s.id)}
                    disabled={procesando === s.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600/20 text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-600/30 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Aprobar
                  </button>
                  <button
                    onClick={() => handleRechazar(s.id)}
                    disabled={procesando === s.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-600/30 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
