import { useEffect, useState } from "react";
import { obtenerVehiculos } from "../../api/flota.api";
import type { Vehiculo } from "../../types/vehiculo";
import { Car, MapPin, Users } from "lucide-react";

export default function ListaVehiculos() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [filtro, setFiltro] = useState("todos");

  useEffect(() => {
    obtenerVehiculos().then(setVehiculos).catch(console.error);
  }, []);

  const filtrados = filtro === "todos" ? vehiculos : vehiculos.filter((v) => v.paradaActual === filtro);

  const paradas = [
    { value: "todos", label: "Todos" },
    { value: "cochabamba", label: "Cochabamba" },
    { value: "eterazama", label: "Eterazama" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Vehiculos Disponibles</h1>
        <p className="text-gray-400 mt-1">Selecciona un trufi para tu viaje</p>
      </div>

      <div className="flex gap-2">
        {paradas.map((p) => (
          <button
            key={p.value}
            onClick={() => setFiltro(p.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              filtro === p.value
                ? "bg-sky-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Car className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No hay vehiculos disponibles en esta parada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((v) => (
            <div key={v.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-sky-500/30 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sky-400 font-bold text-lg font-mono">{v.placa}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  v.paradaActual === "cochabamba"
                    ? "bg-emerald-400/10 text-emerald-400"
                    : v.paradaActual === "eterazama"
                    ? "bg-amber-400/10 text-amber-400"
                    : "bg-red-400/10 text-red-400"
                }`}>
                  {v.paradaActual === "cochabamba" ? "Cochabamba" : v.paradaActual === "eterazama" ? "Eterazama" : "En ruta"}
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{v.choferNombre}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Car className="w-4 h-4" />
                  <span>{v.tipoVehiculo} - {v.color}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span>Puesto #{v.puestoFila}</span>
                </div>
              </div>
              {v.qrImagenUrl && (
                <div className="mt-4 flex justify-center">
                  <img src={v.qrImagenUrl} alt="QR" className="w-24 h-24 object-contain bg-white rounded-lg p-2" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
