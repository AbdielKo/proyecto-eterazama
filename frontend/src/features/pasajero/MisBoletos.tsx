import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { obtenerPasajes } from "../../api/pasajes.api";
import type { Pasaje } from "../../types/pasaje";
import { FileText, QrCode, Share2, MapPin } from "lucide-react";

export default function MisBoletos() {
  const { usuario } = useAuth();
  const [pasajes, setPasajes] = useState<Pasaje[]>([]);
  const [selected, setSelected] = useState<Pasaje | null>(null);

  useEffect(() => {
    obtenerPasajes().then((p) => {
      const nombre = (usuario?.nombre || usuario?.nombreUsuario || "").toLowerCase();
      setPasajes(p.filter((pas: Pasaje) => pas.pasajeroNombre?.toLowerCase().includes(nombre)));
    }).catch(console.error);
  }, [usuario]);

  function shareWhatsApp(p: Pasaje) {
    const text = encodeURIComponent(
      `Pasaje Trans Eterazama\nRuta: ${p.tramo}\nVehiculo: ${p.placaVehiculo}\nAsientos: ${p.asientos?.join(", ")}\nMonto: Bs ${p.montoTotal}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Mis Boletos</h1>
        <p className="text-gray-400 text-sm mt-0.5">Boletos digitales de tus pasajes</p>
      </div>

      {pasajes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <FileText className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500">Sin boletos aun</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pasajes.map((p) => (
            <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sky-400 font-mono font-bold text-lg">{p.placaVehiculo}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      p.estado === "cancelado" ? "bg-red-400/10 text-red-400" : "bg-emerald-400/10 text-emerald-400"
                    }`}>{p.estado || "activo"}</span>
                  </div>
                  <p className="text-sm text-white flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {p.tramo}</p>
                  <p className="text-xs text-gray-400">Pasajero: {p.pasajeroNombre}</p>
                  <p className="text-xs text-gray-400">Asientos: {p.asientos?.join(", ")}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-lg font-bold text-green-400">Bs {p.montoTotal}</p>
                  <p className="text-[10px] text-gray-500">{p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleDateString() : ""}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => setSelected(p)} className="flex items-center gap-1 bg-sky-600/20 text-sky-400 px-3 py-1.5 rounded-lg text-xs hover:bg-sky-600/30 transition-colors cursor-pointer">
                  <QrCode className="w-3.5 h-3.5" /> Ver QR
                </button>
                <button onClick={() => shareWhatsApp(p)} className="flex items-center gap-1 bg-emerald-600/20 text-emerald-400 px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-600/30 transition-colors cursor-pointer">
                  <Share2 className="w-3.5 h-3.5" /> WhatsApp
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-white">Boleto Digital</h3>
            <div className="bg-white rounded-xl p-6 flex flex-col items-center">
              <QrCode className="w-40 h-40 text-black" />
              <p className="text-black text-xs font-mono mt-2">#{selected.id}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 text-left space-y-1">
              <p className="text-sm"><span className="text-gray-400">Pasajero: </span><span className="text-white">{selected.pasajeroNombre}</span></p>
              <p className="text-sm"><span className="text-gray-400">Ruta: </span><span className="text-white">{selected.tramo}</span></p>
              <p className="text-sm"><span className="text-gray-400">Vehiculo: </span><span className="text-sky-400 font-mono">{selected.placaVehiculo}</span></p>
              <p className="text-sm"><span className="text-gray-400">Asientos: </span><span className="text-white">{selected.asientos?.join(", ")}</span></p>
              <p className="text-sm"><span className="text-gray-400">Monto: </span><span className="text-green-400 font-bold">Bs {selected.montoTotal}</span></p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => shareWhatsApp(selected)} className="flex-1 flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-sm transition-colors cursor-pointer">
                <Share2 className="w-4 h-4" /> Compartir
              </button>
              <button onClick={() => setSelected(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded-xl text-sm transition-colors cursor-pointer">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
