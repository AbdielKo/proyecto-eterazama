import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { obtenerVehiculos } from "../../api/flota.api";
import { obtenerPasajes } from "../../api/pasajes.api";
import { crearReview } from "../../api/reviews.api";
import type { Vehiculo } from "../../types/vehiculo";
import type { Pasaje } from "../../types/pasaje";
import { Star, CheckCircle, AlertCircle } from "lucide-react";

export default function CalificarServicio() {
  const { usuario } = useAuth();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [pasajesRecientes, setPasajesRecientes] = useState<Pasaje[]>([]);
  const [vehiculoId, setVehiculoId] = useState("");
  const [estrellas, setEstrellas] = useState(0);
  const [hoverEstrellas, setHoverEstrellas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [exito, setExito] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    Promise.all([
      obtenerVehiculos().catch(() => []),
      obtenerPasajes().catch(() => []),
    ]).then(([v, p]) => {
      setVehiculos(v);
      const nombre = (usuario?.nombre || usuario?.nombreUsuario || "").toLowerCase();
      setPasajesRecientes(p.filter((pas: Pasaje) => pas.pasajeroNombre?.toLowerCase().includes(nombre)).slice(-10).reverse());
    });
  }, [usuario]);

  async function handleSubmit() {
    if (!vehiculoId || estrellas === 0) {
      setError("Selecciona vehiculo y calificacion");
      return;
    }
    setError("");
    setCargando(true);
    try {
      await crearReview({
        usuarioId: String(usuario?.id || ""),
        vehiculoId: Number(vehiculoId),
        estrellas,
        comentario,
      });
      setExito("Calificacion enviada!");
      setEstrellas(0);
      setComentario("");
      setVehiculoId("");
      setTimeout(() => setExito(""), 4000);
    } catch {
      setError("Error al enviar calificacion");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Calificar Servicio</h1>
        <p className="text-gray-400 text-sm mt-0.5">Califica tu ultimo viaje</p>
      </div>

      {exito && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm"><CheckCircle className="w-4 h-4 shrink-0" /> {exito}</div>}
      {error && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Seleccionar vehiculo / chofer</label>
          <select value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
            <option value="">Selecciona un vehiculo</option>
            {vehiculos.map((v) => (
              <option key={v.id} value={v.id}>{v.placa} - {v.choferNombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-2">Calificacion</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} onClick={() => setEstrellas(s)} onMouseEnter={() => setHoverEstrellas(s)} onMouseLeave={() => setHoverEstrellas(0)}
                className="cursor-pointer transition-transform hover:scale-110">
                <Star className={`w-8 h-8 ${
                  s <= (hoverEstrellas || estrellas) ? "text-yellow-400 fill-yellow-400" : "text-gray-700"
                }`} />
              </button>
            ))}
          </div>
          {estrellas > 0 && <p className="text-xs text-gray-500 mt-1">{estrellas} estrella{estrellas > 1 ? "s" : ""}</p>}
        </div>

        <div>
          <label className="block text-xs text-gray-400 mb-1">Comentario (opcional)</label>
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3}
            placeholder="Escribe tu experiencia..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
        </div>

        <button onClick={handleSubmit} disabled={cargando || !vehiculoId || estrellas === 0}
          className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 text-white py-3 rounded-xl font-medium transition-colors cursor-pointer">
          {cargando ? "Enviando..." : "Enviar calificacion"}
        </button>
      </div>

      {pasajesRecientes.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Tus ultimos pasajes</h3>
          <div className="space-y-2">
            {pasajesRecientes.map((p) => (
              <div key={p.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-sky-400 font-mono">{p.placaVehiculo}</p>
                  <p className="text-xs text-gray-400">{p.tramo}</p>
                </div>
                <p className="text-xs text-gray-500">{p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleDateString() : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
