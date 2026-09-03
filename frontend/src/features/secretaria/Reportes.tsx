import { useState } from "react";
import { FileText, Download, BarChart3, Users, Car, DollarSign, Star } from "lucide-react";

export default function Reportes() {
  const [reporteSeleccionado, setReporteSeleccionado] = useState("");

  const reportes = [
    { id: "ventas", label: "Reporte de Ventas", desc: "Historial completo de ventas realizadas", icon: DollarSign, color: "text-green-400 bg-green-400/10" },
    { id: "ingresos", label: "Reporte de Ingresos", desc: "Resumen economico por periodo", icon: BarChart3, color: "text-sky-400 bg-sky-400/10" },
    { id: "vehiculos", label: "Reporte de Vehiculos", desc: "Listado y estado de la flota", icon: Car, color: "text-amber-400 bg-amber-400/10" },
    { id: "choferes", label: "Reporte de Choferes", desc: "Nominas y estadisticas de choferes", icon: Users, color: "text-purple-400 bg-purple-400/10" },
    { id: "pasajeros", label: "Reporte de Pasajeros", desc: "Pasajeros transportados", icon: Users, color: "text-pink-400 bg-pink-400/10" },
    { id: "calificaciones", label: "Reporte de Calificaciones", desc: "Resumen de opiniones y ratings", icon: Star, color: "text-yellow-400 bg-yellow-400/10" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Reportes</h1>
        <p className="text-gray-400 text-sm mt-0.5">Genera y descarga reportes del sistema</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportes.map((r) => {
          const Icon = r.icon;
          return (
            <button
              key={r.id}
              onClick={() => setReporteSeleccionado(reporteSeleccionado === r.id ? "" : r.id)}
              className={`bg-gray-900 border rounded-2xl p-5 text-left transition-all cursor-pointer ${
                reporteSeleccionado === r.id ? "border-sky-500 ring-1 ring-sky-500/30" : "border-gray-800 hover:border-gray-700"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.color} mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white text-sm">{r.label}</h3>
              <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
            </button>
          );
        })}
      </div>

      {reporteSeleccionado && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            {reportes.find((r) => r.id === reporteSeleccionado)?.label}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Fecha desde</label>
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Fecha hasta</label>
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Formato</label>
              <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
                <option value="pdf">PDF</option>
                <option value="excel">Excel</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
              <Download className="w-4 h-4" /> Generar Reporte
            </button>
            <button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-gray-700">
              <FileText className="w-4 h-4" /> Ver Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
