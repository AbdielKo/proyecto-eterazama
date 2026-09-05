import { useEffect, useState } from "react";
import { obtenerVehiculos } from "../../api/flota.api";
import type { Vehiculo } from "../../types/vehiculo";
import {
  normalizarConfiguracion,
  numeroAsientosVendibles,
} from "../../utils/asientos-config";
import DistribucionAsientos from "../../components/DistribucionAsientos";

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
    setSeleccionados((prev) => {
      const nuevos = prev.includes(num) ? prev.filter((a) => a !== num) : [...prev, num];
      return nuevos;
    });
  }

  function confirmar() {
    onSeleccionar(seleccionados);
  }

  if (!vehiculo) return <p className="text-gray-500">Cargando vehiculo...</p>;

  const capacidad = vehiculo.capacidadTotal || 12;
  const config = normalizarConfiguracion(vehiculo.configuracionAsientos, capacidad);
  const chofer = vehiculo.asientosChofer || [];
  const vendibles = numeroAsientosVendibles(config) - chofer.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Seleccionar Asientos</h3>
          <p className="text-sm text-gray-400">{vehiculo.placa} - {vehiculo.choferNombre}</p>
        </div>
        <span className="text-sm text-gray-500">
          {seleccionados.length} seleccionados de {vendibles}
        </span>
      </div>

      <DistribucionAsientos
        config={config}
        asientosChofer={chofer}
        asientosOcupados={vehiculo.asientosOcupados}
        seleccionados={seleccionados}
        onSeleccionar={(num) => toggleAsiento(num)}
      />

      <div className="flex gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-600/30 border border-amber-600/40 rounded" /> Chofer</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-800 border border-gray-700 rounded" /> Disponible</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-sky-600 rounded" /> Seleccionado</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-600/30 rounded" /> Ocupado</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-900 border border-dashed border-gray-700 rounded" /> Espacio</div>
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
