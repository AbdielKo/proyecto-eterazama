import { useState } from "react";
import { crearVehiculo } from "../../api/flota.api";
import type { Vehiculo } from "../../types/vehiculo";

interface Props {
  recargar: () => void;
}

export default function FormVehiculo({ recargar }: Props) {
  const [datos, setDatos] = useState<Vehiculo>({
    placa: "",
    choferNombre: "",
    choferCi: "",
    tipoVehiculo: "",
    color: "",
    paradaActual: "cochabamba",
    puestoFila: 0,
    capacidadTotal: 0,
    asientosOcupados: [],
  } as Vehiculo);
  const [cargando, setCargando] = useState(false);

  function cambiar(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    const numerico = name === "puestoFila" || name === "capacidadTotal";
    setDatos({ ...datos, [name]: numerico ? Number(value) : value });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();

    if (!datos.placa || !datos.choferNombre || !datos.choferCi || !datos.tipoVehiculo) {
      return;
    }

    if (!datos.capacidadTotal || datos.capacidadTotal < 4) {
      return;
    }

    try {
      setCargando(true);
      await crearVehiculo({ ...datos, capacidadTotal: Number(datos.capacidadTotal) });
      setDatos({
        placa: "",
        choferNombre: "",
        choferCi: "",
        tipoVehiculo: "",
        color: "",
        paradaActual: "cochabamba",
        puestoFila: 0,
        capacidadTotal: 0,
        asientosOcupados: [],
      } as Vehiculo);
      recargar();
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <input
        name="placa"
        placeholder="Placa"
        value={datos.placa}
        onChange={cambiar}
        className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
      />
      <input
        name="choferNombre"
        placeholder="Nombre del chofer"
        value={datos.choferNombre}
        onChange={cambiar}
        className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
      />
      <input
        name="choferCi"
        placeholder="CI del chofer"
        value={datos.choferCi}
        onChange={cambiar}
        className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
      />
      <input
        name="tipoVehiculo"
        placeholder="Tipo de vehiculo (Trufi, Minibus...)"
        value={datos.tipoVehiculo}
        onChange={cambiar}
        className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
      />
      <input
        name="color"
        placeholder="Color"
        value={datos.color}
        onChange={cambiar}
        className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
      />
      <input
        name="capacidadTotal"
        type="number"
        min={4}
        placeholder="Cantidad de asientos"
        value={datos.capacidadTotal || ""}
        onChange={cambiar}
        className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
      />
      <button
        type="submit"
        disabled={cargando}
        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer"
      >
        {cargando ? "Guardando..." : "Guardar Vehiculo"}
      </button>
    </form>
  );
}
