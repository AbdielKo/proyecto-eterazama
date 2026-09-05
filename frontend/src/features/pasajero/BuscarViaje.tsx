import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { obtenerVehiculos } from "../../api/flota.api";
import { crearReview } from "../../api/reviews.api";
import type { Vehiculo } from "../../types/vehiculo";
import { ArrowLeftRight, Star, Users, Loader2, ArrowRight, MessageSquare, CheckCircle } from "lucide-react";

export default function BuscarViaje() {
  const { usuario } = useAuth();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [direccion, setDireccion] = useState<"cochabamba_a_eterazama" | "eterazama_a_cochabamba">("cochabamba_a_eterazama");
  const navigate = useNavigate();

  const [modalReview, setModalReview] = useState<Vehiculo | null>(null);
  const [hoverStars, setHoverStars] = useState(0);
  const [rating, setRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    obtenerVehiculos()
      .then((data) => setVehiculos(Array.isArray(data) ? data : []))
      .catch((e) => console.error("Error al cargar vehiculos:", e))
      .finally(() => setCargando(false));
  }, []);

  const cochabamba = vehiculos.filter((v) => v.paradaActual === "cochabamba");
  const eterazama = vehiculos.filter((v) => v.paradaActual === "eterazama");

  const origen = direccion === "cochabamba_a_eterazama" ? cochabamba : eterazama;
  const destino = direccion === "cochabamba_a_eterazama" ? eterazama : cochabamba;
  const nombreOrigen = direccion === "cochabamba_a_eterazama" ? "Cochabamba" : "Eterazama";
  const nombreDestino = direccion === "cochabamba_a_eterazama" ? "Eterazama" : "Cochabamba";
  const tramo = direccion === "cochabamba_a_eterazama" ? "cochabamba" : "eterazama";

  function irAComprar(v: Vehiculo) {
    navigate("/pasajero/comprar", { state: { vehiculo: v, tramo } });
  }

  function abrirModal(v: Vehiculo) {
    setModalReview(v);
    setRating(0);
    setHoverStars(0);
    setComentario("");
    setError("");
  }

  async function enviarReview(estrellas: number, texto: string) {
    if (!modalReview || estrellas === 0) return;
    setEnviando(true);
    setError("");
    try {
      await crearReview({
        usuarioId: String(usuario?.id || ""),
        vehiculoId: Number(modalReview.id),
        estrellas,
        comentario: texto || undefined,
      });
      setExito("Calificacion enviada!");
      setModalReview(null);
      setTimeout(() => setExito(""), 3000);
    } catch {
      setError("Error al enviar");
    } finally {
      setEnviando(false);
    }
  }

  function CardVehiculo({ v }: { v: Vehiculo }) {
    const totalAsientos = v.capacidadTotal || 12;
    const vendibles = (() => {
      if (v.configuracionAsientos && Array.isArray(v.configuracionAsientos.filas)) {
        return v.configuracionAsientos.filas
          .flat()
          .filter((c): c is number => typeof c === "number").length;
      }
      return totalAsientos;
    })();
    const asientosLibres = Math.max(0, vendibles - (v.asientosChofer?.length || 0) - (v.asientosOcupados?.length || 0));
    return (
      <div className="bg-gray-800 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sky-400 font-mono font-bold text-sm">{v.placa}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${asientosLibres > 0 ? "bg-emerald-400/10 text-emerald-400" : "bg-red-400/10 text-red-400"}`}>
            {asientosLibres} asientos
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {v.choferNombre}</span>
          <span>{v.tipoVehiculo}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} className={`w-3 h-3 ${s <= Math.round(Number(v.promedioEstrellas || 0)) ? "text-yellow-400 fill-yellow-400" : "text-gray-700"}`} />
            ))}
            <span className="text-[10px] text-gray-500 ml-1">{Number(v.promedioEstrellas || 0).toFixed(1)}</span>
          </div>
          <button onClick={() => abrirModal(v)} className="text-gray-500 hover:text-sky-400 transition-colors cursor-pointer" title="Calificar y comentar">
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
        </div>
        {asientosLibres > 0 && (
          <button
            onClick={() => irAComprar(v)}
            className="flex items-center justify-center gap-1 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors w-full cursor-pointer"
          >
            Seleccionar <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Buscar y Comprar Pasaje</h1>
          <p className="text-gray-400 text-sm mt-0.5">Selecciona un trufi para comprar tu pasaje</p>
        </div>
        <button
          onClick={() => setDireccion(direccion === "cochabamba_a_eterazama" ? "eterazama_a_cochabamba" : "cochabamba_a_eterazama")}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-750 border border-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors cursor-pointer"
        >
          <ArrowLeftRight className="w-4 h-4 text-sky-400" />
          {direccion === "cochabamba_a_eterazama" ? "Cochabamba → Eterazama" : "Eterazama → Cochabamba"}
        </button>
      </div>

      {exito && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm"><CheckCircle className="w-4 h-4 shrink-0" /> {exito}</div>}

      {cargando ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Loader2 className="w-8 h-8 text-sky-400 mx-auto mb-2 animate-spin" />
          <p className="text-gray-500 text-sm">Cargando vehiculos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400" />
                {nombreOrigen}
              </h2>
              <span className="text-xs text-gray-500">{origen.length} trufis</span>
            </div>
            {origen.length === 0 ? (
              <div className="bg-gray-800 rounded-xl py-10 text-center">
                <p className="text-gray-500 text-sm">Sin trufis en {nombreOrigen}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {origen.map((v) => <CardVehiculo key={v.id} v={v} />)}
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                {nombreDestino}
              </h2>
              <span className="text-xs text-gray-500">{destino.length} trufis</span>
            </div>
            {destino.length === 0 ? (
              <div className="bg-gray-800 rounded-xl py-10 text-center">
                <p className="text-gray-500 text-sm">Sin trufis en {nombreDestino}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {destino.map((v) => <CardVehiculo key={v.id} v={v} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {modalReview && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setModalReview(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white">Calificar chofer</h3>
              <button onClick={() => setModalReview(null)} className="text-gray-500 hover:text-white cursor-pointer">✕</button>
            </div>
            <div className="bg-gray-800 rounded-xl p-3 text-center">
              <p className="text-sky-400 font-mono font-bold">{modalReview.placa}</p>
              <p className="text-xs text-gray-400">{modalReview.choferNombre}</p>
            </div>
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)} onMouseEnter={() => setHoverStars(s)} onMouseLeave={() => setHoverStars(0)}
                  className="cursor-pointer transition-transform hover:scale-110">
                  <Star className={`w-8 h-8 ${s <= (hoverStars || rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-700"}`} />
                </button>
              ))}
            </div>
            {rating > 0 && <p className="text-xs text-gray-500 text-center">{rating} estrella{rating > 1 ? "s" : ""}</p>}
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Escribe tu comentario sobre el chofer..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              onClick={() => enviarReview(rating, comentario)}
              disabled={enviando || rating === 0}
              className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 text-white py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              {enviando ? "Enviando..." : "Enviar calificacion"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
