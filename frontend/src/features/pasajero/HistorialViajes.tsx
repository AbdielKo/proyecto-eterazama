import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { obtenerPasajes } from "../../api/pasajes.api";
import type { Pasaje } from "../../types/pasaje";
import { History, MapPin, Clock } from "lucide-react";

export default function HistorialViajes() {
  const { usuario } = useAuth();
  const [pasajes, setPasajes] = useState<Pasaje[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerPasajes().then((p) => {
      const nombre = (usuario?.nombre || usuario?.nombreUsuario || "").toLowerCase();
      setPasajes(p.filter((pas: Pasaje) => pas.pasajeroNombre?.toLowerCase().includes(nombre)));
      setCargando(false);
    }).catch(() => setCargando(false));
  }, [usuario]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Historial de Viajes</h1>
        <p className="text-gray-400 text-sm mt-0.5">Todos tus viajes realizados</p>
      </div>

      {cargando ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center"><p className="text-gray-500">Cargando...</p></div>
      ) : pasajes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <History className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500">Sin historial de viajes</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pasajes.map((p) => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sky-400 font-mono font-bold">{p.placaVehiculo}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">completado</span>
                </div>
                <p className="text-sm text-white flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {p.tramo}</p>
                <p className="text-xs text-gray-400">Asientos: {p.asientos?.join(", ")}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-green-400 font-bold">Bs {p.montoTotal}</p>
                <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1 justify-end">
                  <Clock className="w-3 h-3" /> {p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleDateString() : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
