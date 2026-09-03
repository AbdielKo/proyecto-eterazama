import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { obtenerHistorialViajes } from "./chofer.api";
import type { MiViaje } from "./chofer.types";
import { History, Filter } from "lucide-react";

const filtros = [
  { key: "todos", label: "Todos" },
  { key: "dia", label: "Hoy" },
  { key: "semana", label: "Esta semana" },
  { key: "mes", label: "Este mes" },
];

const estadoLabels: Record<string, string> = {
  programado: "Programado",
  listo_para_salir: "Listo para salir",
  en_ruta: "En ruta",
  llego_a_destino: "Llego a destino",
  finalizado: "Finalizado",
  viaje_finalizado: "Finalizado",
};

const estadoColors: Record<string, string> = {
  programado: "text-blue-400 bg-blue-400/10",
  listo_para_salir: "text-amber-400 bg-amber-400/10",
  en_ruta: "text-emerald-400 bg-emerald-400/10",
  llego_a_destino: "text-purple-400 bg-purple-400/10",
  finalizado: "text-gray-400 bg-gray-400/10",
  viaje_finalizado: "text-gray-400 bg-gray-400/10",
};

export default function HistorialViajes() {
  const { usuario } = useAuth();
  const [viajes, setViajes] = useState<MiViaje[]>([]);
  const [filtro, setFiltro] = useState("todos");

  useEffect(() => {
    obtenerHistorialViajes(filtro).then(setViajes).catch(console.error);
  }, [filtro]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Historial de viajes</h1>
        <p className="text-gray-400 mt-1">Tus viajes anteriores - {usuario?.placaAsignada || "N/A"}</p>
      </div>

      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        {filtros.map(f => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
              filtro === f.key
                ? "bg-sky-600/20 text-sky-400 font-medium"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {viajes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No hay viajes en este periodo</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Fecha</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Hora</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Origen</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Destino</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Pasajeros</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Asientos</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Total</th>
                  <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-4">Estado</th>
                </tr>
              </thead>
              <tbody>
                {viajes.map((v) => (
                  <tr key={v.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-white">{v.fecha}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{v.horaSalida || "-"}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{v.origen}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{v.destino}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{v.pasajerosTransportados}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{v.asientosOcupados}/{v.capacidadTotal}</td>
                    <td className="px-6 py-4 text-sm text-emerald-400 font-semibold">Bs {v.totalGenerado}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoColors[v.estado] || "text-gray-400 bg-gray-400/10"}`}>
                        {estadoLabels[v.estado] || v.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
