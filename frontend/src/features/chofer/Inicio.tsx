import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import {
  obtenerInicio,
  cambiarEstadoServicio,
  cambiarUbicacion,
  obtenerMiFila,
  anotarseEnFila,
  salirDeFila,
} from "./chofer.api";
import type { ChoferInicio, MiFila } from "./chofer.types";
import { Car, Users, MapPin, Star, Ticket, Power, PowerOff, LogIn, LogOut, LocateFixed } from "lucide-react";

export default function Inicio() {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState<ChoferInicio | null>(null);
  const [miFila, setMiFila] = useState<MiFila | null>(null);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [cambiandoUbicacion, setCambiandoUbicacion] = useState(false);
  const [cambiandoFila, setCambiandoFila] = useState(false);

  async function recargarFila() {
    try {
      setMiFila(await obtenerMiFila());
    } catch (e: any) {
      console.error(e);
    }
  }

  useEffect(() => {
    obtenerInicio().then(setDatos).catch(console.error);
    recargarFila();
  }, []);

  const info = datos || {
    nombre: usuario?.nombre || usuario?.nombreUsuario || "",
    estadoServicio: "inactivo",
    vehiculo: null,
    placa: usuario?.placaAsignada || null,
    paradaActual: null,
    puestoFila: null,
    estadoVehiculo: null,
    estadoViaje: null,
    pasajerosCount: 0,
    asientosOcupados: 0,
    asientosDisponibles: 0,
    calificacionPromedio: 0,
  };

  const estadoServicio = info.estadoServicio === "activo" ? "activo" : "inactivo";

  async function toggleEstadoServicio() {
    setCambiandoEstado(true);
    try {
      const siguiente = estadoServicio === "activo" ? "inactivo" : "activo";
      const resultado = await cambiarEstadoServicio(siguiente);
      setDatos((prev) => (prev ? { ...prev, estadoServicio: resultado.estado } : prev));
    } catch (e: any) {
      alert(e?.response?.data?.message || "No se pudo cambiar el estado de servicio.");
    } finally {
      setCambiandoEstado(false);
    }
  }

  const estadoVehiculoLabel = info.estadoVehiculo === "activo" ? "Activo" : info.estadoVehiculo === "inactivo" ? "Inactivo" : "Inactivo";
  const estadoViajeMap: Record<string, { label: string; color: string }> = {
    en_ruta: { label: "En ruta", color: "bg-sky-400" },
    fin_de_ruta: { label: "Fin de la ruta", color: "bg-purple-400" },
    mantenimiento: { label: "Mantenimiento", color: "bg-amber-400" },
    listo: { label: "Listo", color: "bg-gray-400" },
  };
  const estadoViajeActual = info.estadoViaje || "listo";
  const ev = estadoViajeMap[estadoViajeActual] || estadoViajeMap.listo;

  async function seleccionarUbicacion(ubicacion: "cochabamba" | "eterazama") {
    setCambiandoUbicacion(true);
    try {
      const resultado = await cambiarUbicacion(ubicacion);
      setDatos((prev) =>
        prev
          ? {
              ...prev,
              paradaActual: resultado.paradaActual,
              puestoFila: 0,
              estadoViaje: "listo",
            }
          : prev
      );
      await recargarFila();
      alert(resultado.mensaje);
    } catch (e: any) {
      alert(e?.response?.data?.message || "No se pudo cambiar la ubicación.");
    } finally {
      setCambiandoUbicacion(false);
    }
  }

  async function anotarmeEnFila() {
    setCambiandoFila(true);
    try {
      const parada = miFila?.ubicacion === "eterazama" ? "eterazama" : "cochabamba";
      const resultado = await anotarseEnFila(parada);
      setDatos((prev) =>
        prev
          ? {
              ...prev,
              paradaActual: resultado.paradaActual,
              puestoFila: resultado.puestoFila,
              estadoViaje: "listo",
            }
          : prev
      );
      await recargarFila();
      alert(resultado.mensaje);
    } catch (e: any) {
      alert(e?.response?.data?.message || "No se pudo anotar en la fila.");
    } finally {
      setCambiandoFila(false);
    }
  }

  async function salirDeMiFila() {
    setCambiandoFila(true);
    try {
      const resultado = await salirDeFila();
      setDatos((prev) =>
        prev
          ? { ...prev, puestoFila: 0, estadoViaje: "listo" }
          : prev
      );
      await recargarFila();
      alert(resultado.mensaje);
    } catch (e: any) {
      alert(e?.response?.data?.message || "No se pudo salir de la fila.");
    } finally {
      setCambiandoFila(false);
    }
  }

  const ubicacionActual =
    miFila?.ubicacion === "cochabamba"
      ? "Cochabamba"
      : miFila?.ubicacion === "eterazama"
      ? "Eterazama"
      : "Sin ubicación";
  const anotado = miFila?.yaRegistrado && (miFila.miPuesto || 0) > 0;
  const miPuesto = miFila?.miPuesto || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Inicio</h1>
        <p className="text-gray-400 mt-1">Bienvenido, {info.nombre}</p>
      </div>

      {/* Estado de servicio (ACTIVO/INACTIVO) - lo controla el propio chofer */}
      <div
        className={`rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
          estadoServicio === "activo"
            ? "bg-emerald-500/10 border-emerald-500/30"
            : "bg-red-500/10 border-red-500/30"
        }`}
      >
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              estadoServicio === "activo"
                ? "bg-emerald-400/10"
                : "bg-red-400/10"
            }`}
          >
            {estadoServicio === "activo" ? (
              <Power className="w-5 h-5 text-emerald-400" />
            ) : (
              <PowerOff className="w-5 h-5 text-red-400" />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-400">Estado de servicio</p>
            <p className={`text-2xl font-bold ${estadoServicio === "activo" ? "text-emerald-400" : "text-red-400"}`}>
              {estadoServicio === "activo" ? "ACTIVO" : "INACTIVO"}
            </p>
          </div>
        </div>
        <button
          onClick={toggleEstadoServicio}
          disabled={cambiandoEstado}
          className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
            estadoServicio === "activo"
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          {estadoServicio === "activo" ? (
            <>
              <PowerOff className="w-4 h-4" /> Desactivarme
            </>
          ) : (
            <>
              <Power className="w-4 h-4" /> Activarme
            </>
          )}
        </button>
      </div>

      {/* Mi ubicación actual (COCHABAMBA / ETERAZAMA) - el chofer indica el
          sector en el que se encuentra. La ubicación NO equivale a estar
          anotado en la fila: anotarse es un paso posterior y voluntario. */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-400/10">
            <LocateFixed className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Mi ubicación actual</p>
            <p className="text-lg font-bold text-white">{ubicacionActual}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => seleccionarUbicacion("cochabamba")}
            disabled={cambiandoUbicacion || estadoServicio !== "activo" || ubicacionActual === "Cochabamba"}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              ubicacionActual === "Cochabamba"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 hover:bg-emerald-600 text-gray-200"
            }`}
          >
            <MapPin className="w-4 h-4" /> Estoy en Cochabamba
          </button>
          <button
            onClick={() => seleccionarUbicacion("eterazama")}
            disabled={cambiandoUbicacion || estadoServicio !== "activo" || ubicacionActual === "Eterazama"}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              ubicacionActual === "Eterazama"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 hover:bg-emerald-600 text-gray-200"
            }`}
          >
            <MapPin className="w-4 h-4" /> Estoy en Eterazama
          </button>
        </div>
        {estadoServicio !== "activo" && (
          <p className="text-xs text-gray-500 mt-3">
            Activa tu estado de servicio para poder indicar tu ubicación.
          </p>
        )}
      </div>

      {/* Estado en la fila: anotarse es voluntario y solo dentro del sector
          donde estás ubicado. */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-400/10">
              <Users className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Estado en la fila</p>
              {anotado ? (
                <p className="text-lg font-bold text-white">
                  Anotado en {ubicacionActual} · Puesto #{miPuesto}
                </p>
              ) : (
                <p className="text-lg font-bold text-gray-300">
                  No estás anotado en la fila
                </p>
              )}
            </div>
          </div>
          {anotado ? (
            <button
              onClick={salirDeMiFila}
              disabled={cambiandoFila}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" /> Salir de la fila
            </button>
          ) : (
            <button
              onClick={anotarmeEnFila}
              disabled={cambiandoFila || estadoServicio !== "activo" || !(ubicacionActual === "Cochabamba" || ubicacionActual === "Eterazama")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <LogIn className="w-4 h-4" /> Anotarme en {ubicacionActual === "Eterazama" ? "Eterazama" : "Cochabamba"}
            </button>
          )}
        </div>
        {!anotado && (ubicacionActual === "Cochabamba" || ubicacionActual === "Eterazama") && (
          <p className="text-xs text-gray-500">
            Al anotarte ocuparás un puesto numerado en la fila de {ubicacionActual}.
          </p>
        )}
        {miFila?.totalEnFila ? (
          <p className="text-xs text-gray-500 mt-3">
            {miFila.totalEnFila} vehículo(s) en la fila de {ubicacionActual} 
            {anotado ? ` · Delante de ti: ${(miFila.delante || []).length}` : ""}
            {anotado ? ` · Detrás de ti: ${(miFila.detras || []).length}` : ""}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-400/10">
              <Car className="w-5 h-5 text-sky-400" />
            </div>
            <p className="text-sm text-gray-400">Vehiculo asignado</p>
          </div>
          <p className="text-lg font-semibold text-white">{info.vehiculo || "Sin asignar"}</p>
          <p className="text-sm text-gray-500 mt-1">Placa: {info.placa || "N/A"}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-400/10">
              <MapPin className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-sm text-gray-400">Ubicación actual</p>
          </div>
          <p className="text-lg font-semibold text-white capitalize">
            {estadoServicio === "activo" ? ubicacionActual : "Fuera de servicio"}
          </p>
          {anotado && (
            <p className="text-sm text-gray-500 mt-1">Puesto en fila: #{miPuesto}</p>
          )}
          {!anotado && estadoServicio === "activo" && (
            <p className="text-sm text-gray-500 mt-1">Ubicado, sin anotar en fila</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-400/10">
              <Star className="w-5 h-5 text-amber-400" />
            </div>
            <p className="text-sm text-gray-400">Calificacion promedio</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-white">{info.calificacionPromedio}</p>
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-sm text-gray-400">Estado del trufi</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-3 h-3 rounded-full animate-pulse ${
              info.estadoVehiculo === 'activo' ? 'bg-emerald-400' : 'bg-gray-500'
            }`} />
            <span className="text-lg font-semibold text-white capitalize">{estadoVehiculoLabel}</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-sm text-gray-400">Estado del viaje</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-3 h-3 rounded-full ${ev.color}`} />
            <span className="text-lg font-semibold text-white">{ev.label}</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-sky-400" />
            <p className="text-sm text-gray-400">Pasajeros</p>
          </div>
          <p className="text-2xl font-bold text-white">{info.pasajerosCount}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="w-5 h-5 text-emerald-400" />
            <p className="text-sm text-gray-400">Asientos</p>
          </div>
          <p className="text-lg font-bold text-white">
            {info.asientosOcupados} / {info.asientosOcupados + info.asientosDisponibles}
          </p>
          <div className="w-full bg-gray-800 rounded-full h-2 mt-2">
            <div
              className="bg-emerald-400 h-2 rounded-full transition-all"
              style={{ width: `${info.asientosOcupados + info.asientosDisponibles > 0 ? (info.asientosOcupados / (info.asientosOcupados + info.asientosDisponibles)) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-sm text-gray-400">Disponibles</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{info.asientosDisponibles}</p>
        </div>
      </div>
    </div>
  );
}
