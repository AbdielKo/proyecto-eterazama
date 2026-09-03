import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { obtenerReviews } from "../../api/reviews.api";
import type { Review } from "../../types/review";
import { Star, MessageSquare } from "lucide-react";

export default function MisResenas() {
  const { usuario } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerReviews().then((r) => {
      const uid = String(usuario?.id || "");
      setReviews(r.filter((rev: Review) => rev.usuarioId === uid));
      setCargando(false);
    }).catch(() => setCargando(false));
  }, [usuario]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Mis Resenas</h1>
        <p className="text-gray-400 text-sm mt-0.5">Calificaciones que has enviado</p>
      </div>

      {cargando ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center"><p className="text-gray-500">Cargando...</p></div>
      ) : reviews.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500">Sin resenas aun</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-4 h-4 ${s <= (r.estrellas || 0) ? "text-yellow-400 fill-yellow-400" : "text-gray-700"}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400">Vehiculo: <span className="text-sky-400 font-mono">{r.placa || `#${r.vehiculoId}`}</span></p>
                  {r.comentario && <p className="text-sm text-gray-300 mt-1">{r.comentario}</p>}
                </div>
                <p className="text-[10px] text-gray-500">{r.fechaCreacion ? new Date(r.fechaCreacion).toLocaleDateString() : ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
