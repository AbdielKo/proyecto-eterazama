import { useEffect, useState } from "react";
import { obtenerVehiculos } from "../../api/flota.api";
import type { Vehiculo } from "../../types/vehiculo";
import { CheckCircle, Circle } from "lucide-react";

interface Props {
  placa: string;
  onSeleccionar: (asientos: number[]) => void;
}

export default function SeleccionAsientos({ placa, onSeleccionar }: Props) {
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [seleccionados, setSeleccionados] = useState<number[]>([]);

  useEffect(() => {
    obtenerVehiculos().then((data) => {
      const v = data.find((veh: Vehiculo) => veh.placa === placa);
      setVehiculo(v || null);
    });
  }, [placa]);

  function toggleAsiento(num: number) {
    if (asientosChofer.includes(num)) return;
    setSeleccionados((prev) => {
      const nuevos = prev.includes(num) ? prev.filter((a) => a !== num) : [...prev, num];
      return nuevos;
    });
  }

  function confirmar() {
    onSeleccionar(seleccionados);
  }

  if (!vehiculo) return <p className="text-gray-500">Cargando vehiculo...</p>;

  const totalAsientos = Math.max(4, vehiculo.capacidadTotal || 12);
  const ocupados = vehiculo.asientosOcupados || [];
  const asientosChofer = [1, 2];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Seleccionar Asientos</h3>
          <p className="text-sm text-gray-400">{vehiculo.placa} - {vehiculo.choferNombre}</p>
        </div>
        <span className="text-sm text-gray-500">
          {seleccionados.length} seleccionados
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 max-w-sm">
        {Array.from({ length: totalAsientos }, (_, i) => i + 1).map((num) => {
          const ocupado = ocupados.includes(num) || asientosChofer.includes(num);
          const seleccionado = seleccionados.includes(num);
          return (
            <button
              key={num}
              onClick={() => !ocupado && toggleAsiento(num)}
              disabled={ocupado}
              className={`flex items-center justify-center gap-1 p-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                ocupado
                  ? asientosChofer.includes(num)
                    ? "bg-amber-600/20 text-amber-400 cursor-not-allowed"
                    : "bg-red-600/20 text-red-400 cursor-not-allowed"
                  : seleccionado
                  ? "bg-sky-600 text-white ring-2 ring-sky-400"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {ocupado ? (
                <Circle className="w-4 h-4" />
              ) : seleccionado ? (
                <CheckCircle className="w-4 h-4" />
              ) : null}
              {num}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-800 rounded" /> Disponible</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-sky-600 rounded" /> Seleccionado</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-600/30 rounded" /> Ocupado</div>
      </div>

      {seleccionados.length > 0 && (
        <button
          onClick={confirmar}
          className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors cursor-pointer"
        >
          Confirmar {seleccionados.length} asiento{seleccionados.length > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
