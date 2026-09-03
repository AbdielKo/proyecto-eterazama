import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { crearReview } from "../../api/reviews.api";
import { Star } from "lucide-react";

interface Props {
  vehiculoId?: number;
  pasajeId?: string;
  onExito?: () => void;
}

export default function CrearReview({ vehiculoId, pasajeId, onExito }: Props) {
  const { usuario } = useAuth();
  const [estrellas, setEstrellas] = useState(5);
  const [comentario, setComentario] = useState("");
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!usuario || !vehiculoId || !pasajeId) return;

    try {
      setCargando(true);
      await crearReview({
        usuarioId: String(usuario.id),
        vehiculoId,
        pasajeId,
        estrellas,
        comentario,
      });
      setExito(true);
      setEstrellas(5);
      setComentario("");
      onExito?.();
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  }

  if (exito) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
        <div className="w-12 h-12 bg-emerald-400/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <Star className="w-6 h-6 text-emerald-400 fill-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">Gracias por calificar!</h3>
        <p className="text-sm text-gray-400 mt-1">Tu opinion nos ayuda a mejorar</p>
        <button
          onClick={() => setExito(false)}
          className="mt-4 text-sky-400 hover:text-sky-300 text-sm cursor-pointer"
        >
          Calificar otro viaje
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={guardar} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
      <h3 className="text-lg font-semibold text-white">Califica tu viaje</h3>

      <div>
        <label className="block text-sm text-gray-400 mb-2">Estrellas</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setEstrellas(s)}
              className="cursor-pointer transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 ${
                  s <= estrellas ? "text-yellow-400 fill-yellow-400" : "text-gray-700"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm text-gray-400 mb-1.5">Comentario (opcional)</label>
        <textarea
          placeholder="Cuenta tu experiencia..."
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          rows={3}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={cargando || !vehiculoId || !pasajeId}
        className="bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-xl transition-colors cursor-pointer"
      >
        {cargando ? "Enviando..." : "Enviar Calificacion"}
      </button>
    </form>
  );
}
