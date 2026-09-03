import { useEffect, useState } from "react";
import { obtenerReviews } from "../../api/reviews.api";
import type { Review } from "../../types/review";
import { Star, MessageSquare } from "lucide-react";

export default function ListaReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    obtenerReviews().then(setReviews).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Opiniones de Usuarios</h1>
        <p className="text-gray-400 mt-1">Todas las calificaciones recibidas</p>
      </div>

      {reviews.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Star className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No hay opiniones aun</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-white">{r.nombreUsuario || "Anonimo"}</p>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${s <= r.estrellas ? "text-yellow-400 fill-yellow-400" : "text-gray-700"}`}
                      />
                    ))}
                  </div>
                </div>
                <span className="text-xs text-gray-600">
                  {r.fechaCreacion ? new Date(r.fechaCreacion).toLocaleDateString() : ""}
                </span>
              </div>
              {r.comentario && (
                <div className="flex items-start gap-2 mt-3 bg-gray-800 rounded-xl p-3">
                  <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-gray-300">{r.comentario}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
