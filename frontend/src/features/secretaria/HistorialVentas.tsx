import { useEffect, useState } from "react";
import { obtenerVentasSecretaria, obtenerNomina, type NominaItem } from "../../api/secretaria.api";
import type { Pasaje } from "../../types/pasaje";
import { ClipboardList, Search, Download } from "lucide-react";

const periodos = [
  { value: "todos", label: "Todo" },
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
];

export default function HistorialVentas() {
  const [ventas, setVentas] = useState<Pasaje[]>([]);
  const [totalBs, setTotalBs] = useState(0);
  const [cantidad, setCantidad] = useState(0);
  const [busqueda, setBusqueda] = useState("");
  const [periodo, setPeriodo] = useState("todos");
  const [choferes, setChoferes] = useState<NominaItem[]>([]);
  const [choferId, setChoferId] = useState("");
  const [placa, setPlaca] = useState("");

  async function cargar() {
    try {
      const data = await obtenerVentasSecretaria({
        periodo,
        choferId: choferId || undefined,
        placa: placa || undefined,
      });
      setVentas(data.ventas as Pasaje[]);
      setTotalBs(data.resumen.totalBs);
      setCantidad(data.resumen.cantidadVentas);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    obtenerNomina().then(setChoferes).catch(console.error);
  }, []);

  useEffect(() => {
    cargar();
  }, [periodo, choferId, placa]);

  const placas = Array.from(
    new Set(
      choferes
        .map((c) => c.placa)
        .filter((p): p is string => Boolean(p))
    )
  );

  const ventasFiltradas = ventas.filter((v) => {
    const busquedaTexto = [
      v.pasajeroNombre,
      v.placaVehiculo,
      v.tramo,
      ...(v.pasajeros || []).map((p) => p.nombre),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchBusqueda = busquedaTexto.includes(busqueda.toLowerCase());
    return matchBusqueda;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Historial de Ventas</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {cantidad} ventas | Total: <span className="text-green-400 font-semibold">Bs {totalBs}</span>
          </p>
        </div>
        <button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer border border-gray-700">
          <Download className="w-4 h-4" /> Exportar
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por pasajero, placa o tramo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Periodo</label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {periodos.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Chofer</label>
            <select
              value={choferId}
              onChange={(e) => setChoferId(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Todos</option>
              {choferes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombreCompleto}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Vehiculo</label>
            <select
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Todos</option>
              {placas.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {ventasFiltradas.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No hay ventas que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Pasajero</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Placa</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Asientos</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Tramo</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Pasaje</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Encomienda</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Total</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Pago</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.map((v) => (
                  <tr key={v.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      <p className="text-white font-medium">{v.pasajeroNombre}</p>
                      {v.pasajeros && v.pasajeros.length > 1 && (
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {v.pasajeros.map((p) => `${p.nombre} (A${p.asiento})`).join(", ")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-sky-400 font-mono">{v.placaVehiculo}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{v.asientos?.join(", ")}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{v.tramo}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">Bs {v.montoAsientos}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">Bs {v.montoEncomienda}</td>
                    <td className="px-4 py-3 text-sm text-green-400 font-semibold">
                      Bs {v.montoTotal}
                      {v.estadoReembolso === "REEMBOLSADO" && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-400/10 text-red-400 align-middle">
                          REEMBOLSADO
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          v.metodoPago === "EFECTIVO"
                            ? "bg-emerald-400/10 text-emerald-400"
                            : "bg-gray-800 text-gray-500"
                        }`}
                      >
                        {v.metodoPago || "EFECTIVO"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{v.fechaCreacion ? new Date(v.fechaCreacion).toLocaleDateString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
