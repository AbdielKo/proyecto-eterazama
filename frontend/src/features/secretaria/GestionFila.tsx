import { useEffect, useState } from "react";
import { obtenerVehiculos, trasladarVehiculo } from "../../api/flota.api";
import api from "../../api/axios";
import type { Vehiculo } from "../../types/vehiculo";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import { MapPin, ArrowRight, ArrowUp, ArrowDown, Send } from "lucide-react";

export default function GestionFila() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);

  async function cargar() {
    try {
      const data = await obtenerVehiculos();
      setVehiculos(data);
    } catch (error) {
      console.error(error);
    }
  }

  useFlotaSocket(cargar);

  useEffect(() => { cargar(); }, []);

  async function mover(id: number, parada: string) {
    try { await trasladarVehiculo(id, parada); cargar(); } catch (error) { console.error(error); }
  }

  async function reordenar(cambios: { id: number; puestoFila: number }[]) {
    try {
      await api.patch("/flota", { cambios });
      cargar();
    } catch (error) {
      console.error(error);
    }
  }

  function moverOrden(lista: Vehiculo[], index: number, dir: -1 | 1) {
    const destino = index + dir;
    if (destino < 0 || destino >= lista.length) return;
    const nueva = [...lista];
    [nueva[index], nueva[destino]] = [nueva[destino], nueva[index]];
    const cambios = nueva.map((v, i) => ({ id: v.id!, puestoFila: i + 1 }));
    reordenar(cambios);
  }

  const cochabamba = vehiculos.filter((v) => v.paradaActual === "cochabamba").sort((a, b) => (a.puestoFila || 0) - (b.puestoFila || 0));
  const eterazama = vehiculos.filter((v) => v.paradaActual === "eterazama").sort((a, b) => (a.puestoFila || 0) - (b.puestoFila || 0));
  const fuera = vehiculos.filter((v) => v.paradaActual === "fuera_de_fila");
  const enRuta = vehiculos.filter((v) => v.paradaActual === "en_ruta");

  function renderLista(titulo: string, color: string, lista: Vehiculo[], acciones: { label: string; destino: string; icon: typeof ArrowRight }[], reordenable = false) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className={`w-4 h-4 ${color}`} />
          <h2 className="text-sm font-semibold text-white">{titulo}</h2>
          <span className="ml-auto bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{lista.length}</span>
        </div>
        {lista.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">Sin vehiculos</p>
        ) : (
          <div className="space-y-2">
            {lista.map((v, index) => (
              <div key={v.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">#{v.puestoFila ?? "-"}</span>
                    <span className="font-semibold text-sky-400 text-sm">{v.placa}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{v.choferNombre}</p>
                </div>
                <div className="flex gap-1 shrink-0 items-center">
                  {reordenable && (
                    <>
                      <button onClick={() => moverOrden(lista, index, -1)} className="p-1.5 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer" title="Subir">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => moverOrden(lista, index, 1)} className="p-1.5 bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer" title="Bajar">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  {acciones.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => v.id !== undefined && mover(v.id, a.destino)}
                      className="p-1.5 bg-sky-600/20 text-sky-400 rounded-lg hover:bg-sky-600/30 transition-colors cursor-pointer"
                      title={a.label}
                    >
                      <a.icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Filas y Paradas</h1>
        <p className="text-gray-400 text-sm mt-0.5">Controla el orden de salida y paradas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderLista("Cochabamba", "text-emerald-400", cochabamba, [
          { label: "Enviar Eterazama", destino: "eterazama", icon: ArrowRight },
          { label: "Enviar a ruta", destino: "fuera_de_fila", icon: Send },
        ], true)}
        {renderLista("Eterazama", "text-amber-400", eterazama, [
          { label: "Enviar Cochabamba", destino: "cochabamba", icon: ArrowRight },
          { label: "Enviar a ruta", destino: "fuera_de_fila", icon: Send },
        ], true)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderLista("En ruta", "text-purple-400", enRuta, [
          { label: "Finalizar - Cochabamba", destino: "cochabamba", icon: ArrowDown },
          { label: "Finalizar - Eterazama", destino: "eterazama", icon: ArrowDown },
        ])}
        {renderLista("Fuera de servicio", "text-red-400", fuera, [
          { label: "Reactivar - Cochabamba", destino: "cochabamba", icon: ArrowUp },
          { label: "Reactivar - Eterazama", destino: "eterazama", icon: ArrowUp },
        ])}
      </div>
    </div>
  );
}
