import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { obtenerInicio } from "./chofer.api";
import type { ChoferInicio } from "./chofer.types";
import { Car, Users, MapPin, Star, Ticket } from "lucide-react";

export default function Inicio() {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState<ChoferInicio | null>(null);

  useEffect(() => {
    obtenerInicio().then(setDatos).catch(console.error);
  }, []);

  const info = datos || {
    nombre: usuario?.nombre || usuario?.nombreUsuario || "",
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

  const estadoVehiculoLabel = info.estadoVehiculo === "activo" ? "Activo" : info.estadoVehiculo === "inactivo" ? "Inactivo" : "Inactivo";
  const estadoViajeMap: Record<string, { label: string; color: string }> = {
    en_ruta: { label: "En ruta", color: "bg-sky-400" },
    fin_de_ruta: { label: "Fin de la ruta", color: "bg-purple-400" },
    mantenimiento: { label: "Mantenimiento", color: "bg-amber-400" },
    listo: { label: "Listo", color: "bg-gray-400" },
  };
  const estadoViajeActual = info.estadoViaje || "listo";
  const ev = estadoViajeMap[estadoViajeActual] || estadoViajeMap.listo;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Inicio</h1>
        <p className="text-gray-400 mt-1">Bienvenido, {info.nombre}</p>
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
            <p className="text-sm text-gray-400">Parada actual</p>
          </div>
          <p className="text-lg font-semibold text-white capitalize">{info.paradaActual || "Sin ubicacion"}</p>
          {info.puestoFila && (
            <p className="text-sm text-gray-500 mt-1">Puesto en fila: #{info.puestoFila}</p>
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
