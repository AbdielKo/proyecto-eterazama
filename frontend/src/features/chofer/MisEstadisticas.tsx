import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { obtenerMisEstadisticas } from "./chofer.api";
import type { EstadisticasChofer } from "./chofer.types";
import { BarChart3, Users, Route, Star, Filter } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const periodos = [
  { key: "todos", label: "Todos" },
  { key: "dia", label: "Hoy" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
];

export default function MisEstadisticas() {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState<EstadisticasChofer | null>(null);
  const [periodo, setPeriodo] = useState("todos");

  useEffect(() => {
    obtenerMisEstadisticas(periodo).then(setDatos).catch(console.error);
  }, [periodo]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Mis estadisticas</h1>
        <p className="text-gray-400 mt-1">Tus resultados - {usuario?.placaAsignada || "N/A"}</p>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {periodos.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriodo(p.key)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
              periodo === p.key
                ? "bg-sky-600/20 text-sky-400 font-medium"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {datos && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-sky-400/10 mb-3">
                <Route className="w-5 h-5 text-sky-400" />
              </div>
              <p className="text-sm text-gray-400">Total de viajes</p>
              <p className="text-3xl font-bold text-white mt-1">{datos.totalViajes}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-400/10 mb-3">
                <Users className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-sm text-gray-400">Total de pasajeros</p>
              <p className="text-3xl font-bold text-white mt-1">{datos.totalPasajeros}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-400/10 mb-3">
                <BarChart3 className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-sm text-gray-400">Promedio pasajeros/viaje</p>
              <p className="text-3xl font-bold text-white mt-1">{datos.promedioPasajerosPorViaje}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-400/10 mb-3">
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              </div>
              <p className="text-sm text-gray-400">Promedio calificacion</p>
              <p className="text-3xl font-bold text-white mt-1">{datos.promedioCalificacion}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-400/10 mb-3">
                <BarChart3 className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-sm text-gray-400">Cantidad de resenas</p>
              <p className="text-3xl font-bold text-white mt-1">{datos.cantidadResenas}</p>
            </div>
          </div>

          {datos.graficoViajes && datos.graficoViajes.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Evolucion de viajes</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={datos.graficoViajes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="fecha" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                    labelStyle={{ color: "#F3F4F6" }}
                  />
                  <Bar dataKey="pasajeros" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {datos.graficoViajes && datos.graficoViajes.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Ingresos generados</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={datos.graficoViajes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="fecha" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1F2937", border: "1px solid #374151", borderRadius: "8px" }}
                    labelStyle={{ color: "#F3F4F6" }}
                  />
                  <Line type="monotone" dataKey="generado" stroke="#34D399" strokeWidth={2} dot={{ fill: "#34D399" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
}
