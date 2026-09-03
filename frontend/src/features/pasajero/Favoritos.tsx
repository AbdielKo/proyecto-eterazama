import { useEffect, useState } from "react";
import { obtenerVehiculos } from "../../api/flota.api";
import type { Vehiculo } from "../../types/vehiculo";
import { Heart, Star, Trash2 } from "lucide-react";

type Favorito = {
  vehiculo: Vehiculo;
  tipo: "chofer" | "ruta" | "vehiculo";
};

export default function Favoritos() {
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [tab, setTab] = useState<"chofer" | "ruta" | "vehiculo">("chofer");
  const [showAdd, setShowAdd] = useState(false);
  const [seleccion, setSeleccion] = useState<number | null>(null);

  useEffect(() => {
    const guardados = localStorage.getItem("favoritos_pasajero");
    if (guardados) setFavoritos(JSON.parse(guardados));
    obtenerVehiculos().then(setVehiculos).catch(console.error);
  }, []);

  function persistir(nuevos: Favorito[]) {
    setFavoritos(nuevos);
    localStorage.setItem("favoritos_pasajero", JSON.stringify(nuevos));
  }

  function agregar() {
    if (seleccion === null) return;
    const v = vehiculos.find((vh) => vh.id === seleccion);
    if (!v) return;
    if (favoritos.some((f) => f.vehiculo.id === v.id && f.tipo === tab)) return;
    persistir([...favoritos, { vehiculo: v, tipo: tab }]);
    setShowAdd(false);
    setSeleccion(null);
  }

  function eliminar(idx: number) {
    const nuevos = [...favoritos];
    nuevos.splice(idx, 1);
    persistir(nuevos);
  }

  const filtrados = favoritos.filter((f) => f.tipo === tab);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Favoritos</h1>
          <p className="text-gray-400 text-sm mt-0.5">Tus choferes, rutas y vehiculos guardados</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer">+ Agregar</button>
      </div>

      <div className="flex gap-2">
        {(["chofer", "ruta", "vehiculo"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer capitalize ${tab === t ? "bg-sky-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}>
            {t === "chofer" ? "Choferes" : t === "ruta" ? "Rutas" : "Vehiculos"}
          </button>
        ))}
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Heart className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500">Sin favoritos en esta categoria</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map((f, idx) => (
            <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-sky-400 font-mono font-bold">{f.vehiculo.placa}</p>
                <p className="text-sm text-gray-400">{f.vehiculo.choferNombre} | {f.vehiculo.tipoVehiculo}</p>
                {tab === "chofer" && (
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-3 h-3 ${s <= Math.round(f.vehiculo.promedioEstrellas || 0) ? "text-yellow-400 fill-yellow-400" : "text-gray-700"}`} />
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => eliminar(favoritos.indexOf(f))} className="text-gray-500 hover:text-red-400 transition-colors cursor-pointer">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-white">Agregar favorito</h3>
            <select value={seleccion ?? ""} onChange={(e) => setSeleccion(Number(e.target.value))} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
              <option value="">Selecciona un vehiculo</option>
              {vehiculos.map((v) => (
                <option key={v.id} value={v.id}>{v.placa} - {v.choferNombre}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={agregar} disabled={!seleccion} className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 text-white py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer">Agregar</button>
              <button onClick={() => setShowAdd(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-xl text-sm transition-colors cursor-pointer">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
