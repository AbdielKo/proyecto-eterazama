import { useEffect, useState } from "react";
import { obtenerNomina, obtenerResenasChofer, type NominaItem, type ResenasChofer } from "../../api/secretaria.api";
import { Star, Users, MessageSquare, ThumbsUp, ThumbsDown, ChevronDown } from "lucide-react";

export default function ReviewsChoferes() {
  const [choferes, setChoferes] = useState<NominaItem[]>([]);
  const [choferId, setChoferId] = useState("");
  const [datos, setDatos] = useState<ResenasChofer | null>(null);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    obtenerNomina().then(setChoferes).catch(console.error);
  }, []);

  useEffect(() => {
    if (!choferId) {
      setDatos(null);
      return;
    }
    setCargando(true);
    obtenerResenasChofer(choferId)
      .then(setDatos)
      .catch(() => setDatos(null))
      .finally(() => setCargando(false));
  }, [choferId]);

  const positivas = datos?.comentarios.filter((c) => c.estrellas >= 4).length ?? 0;
  const negativas = datos?.comentarios.filter((c) => c.estrellas <= 2).length ?? 0;
  const choferSeleccionado = choferes.find((c) => c.id === choferId);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Calificaciones y Resenas</h1>
          <p className="text-gray-400 text-sm mt-0.5">Resenas reales de los usuarios por chofer</p>
        </div>
        <div className="relative">
          <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <select
            value={choferId}
            onChange={(e) => setChoferId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 appearance-none cursor-pointer"
          >
            <option value="">Seleccionar chofer...</option>
            {choferes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombreCompleto} {c.placa ? `(${c.placa})` : ""}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {!choferId ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Star className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Selecciona un chofer para ver sus resenas</p>
        </div>
      ) : cargando ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <p className="text-gray-500 text-sm">Cargando resenas...</p>
        </div>
      ) : datos ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <Star className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-[11px] text-gray-500">Promedio</p>
                <p className="text-xl font-bold text-white">{datos.promedio}</p>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-sky-400" />
              <div>
                <p className="text-[11px] text-gray-500">Total resenas</p>
                <p className="text-xl font-bold text-white">{datos.cantidad}</p>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <ThumbsUp className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-[11px] text-gray-500">Positivas</p>
                <p className="text-xl font-bold text-white">{positivas}</p>
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <ThumbsDown className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-[11px] text-gray-500">Negativas</p>
                <p className="text-xl font-bold text-white">{negativas}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-[11px] text-gray-500 mb-2">Distribucion de estrellas</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((s) => {
                const cantidad = datos.distribucion?.[s] ?? 0;
                const pct = datos.cantidad > 0 ? (cantidad / datos.cantidad) * 100 : 0;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-8 flex items-center gap-1">
                      {s} <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    </span>
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-6 text-right">{cantidad}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">
              Comentarios de {choferSeleccionado?.nombreCompleto}
            </h3>
            {datos.comentarios.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">Sin comentarios</p>
            ) : (
              <div className="space-y-2">
                {datos.comentarios.map((r) => (
                  <div key={r.id} className="bg-gray-800 rounded-xl p-3 flex items-start gap-3">
                    <div className="flex gap-0.5 shrink-0 mt-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`w-3 h-3 ${s <= r.estrellas ? "text-yellow-400 fill-yellow-400" : "text-gray-700"}`} />
                      ))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-300">{r.comentario || "Sin comentario"}</p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {r.fechaCreacion ? new Date(r.fechaCreacion).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <p className="text-gray-500 text-sm">Este chofer aun no tiene resenas</p>
        </div>
      )}
    </div>
  );
}
