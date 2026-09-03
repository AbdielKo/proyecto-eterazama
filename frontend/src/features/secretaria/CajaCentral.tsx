import { useEffect, useState } from "react";
import { obtenerCajaSecretaria, type CajaSecretaria } from "../../api/secretaria.api";
import { obtenerPasajes } from "../../api/pasajes.api";
import type { Pasaje } from "../../types/pasaje";
import { DollarSign, Ticket, Package, TrendingUp, Search, Filter } from "lucide-react";

export default function CajaCentral() {
  const [caja, setCaja] = useState<CajaSecretaria>({
    totalBoletosEmitidos: 0,
    totalVentas: 0,
    subtotalAsientos: 0,
    subtotalEncomiendas: 0,
    montoTotalCaja: 0,
  });
  const [pasajes, setPasajes] = useState<Pasaje[]>([]);
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [cargando, setCargando] = useState(true);

  async function cargar() {
    setCargando(true);
    try {
      const [c, p] = await Promise.all([
        obtenerCajaSecretaria(),
        obtenerPasajes().catch(() => [] as Pasaje[]),
      ]);
      setCaja(c);
      setPasajes(p);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = pasajes.filter((p) =>
    !filtroPlaca || p.placaVehiculo?.toLowerCase().includes(filtroPlaca.toLowerCase())
  );

  const items = [
    { label: "Boletos vendidos", value: caja.totalBoletosEmitidos, icon: Ticket, color: "text-sky-400 bg-sky-400/10" },
    { label: "Ventas", value: caja.totalVentas, icon: Filter, color: "text-cyan-400 bg-cyan-400/10" },
    { label: "Pasajes", value: `Bs ${caja.subtotalAsientos}`, icon: DollarSign, color: "text-emerald-400 bg-emerald-400/10" },
    { label: "Encomiendas", value: `Bs ${caja.subtotalEncomiendas}`, icon: Package, color: "text-amber-400 bg-amber-400/10" },
    { label: "TOTAL CAJA", value: `Bs ${caja.montoTotalCaja}`, icon: TrendingUp, color: "text-green-400 bg-green-400/10" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Caja Central</h1>
          <p className="text-gray-400 text-sm mt-0.5">Control completo de ingresos reales</p>
        </div>
        <button onClick={cargar} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer border border-gray-700">
          Actualizar
        </button>
      </div>

      {cargando ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-12 text-center">
          <p className="text-gray-500 text-sm">Cargando caja...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.color} mb-2`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-gray-500">{item.label}</p>
                  <p className="text-lg font-bold text-white mt-0.5">{item.value}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">Movimientos</h3>
            </div>
            <div className="flex gap-3 mb-4 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Filtrar por placa..."
                  value={filtroPlaca}
                  onChange={(e) => setFiltroPlaca(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>
              <span className="flex items-center text-sm text-gray-400">
                Total filtrado: <span className="text-green-400 font-semibold ml-1">Bs {filtrados.reduce((a, p) => a + (p.montoTotal || 0), 0)}</span>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-3 py-2">Pasajero</th>
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-3 py-2">Placa</th>
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-3 py-2">Tramo</th>
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-3 py-2">Pasajes</th>
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-3 py-2">Encomienda</th>
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-3 py-2">Total</th>
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-3 py-2">Pago</th>
                    <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-3 py-2">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.slice(0, 50).map((p) => (
                    <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-3 py-2 text-sm text-white">
                        {p.pasajeroNombre}
                        {p.pasajeros && (
                          <p className="text-[10px] text-gray-500">{p.pasajeros.map((x) => x.nombre).join(", ")}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-sky-400 font-mono">{p.placaVehiculo}</td>
                      <td className="px-3 py-2 text-sm text-gray-400">{p.tramo}</td>
                      <td className="px-3 py-2 text-sm text-gray-300">Bs {p.montoAsientos}</td>
                      <td className="px-3 py-2 text-sm text-gray-300">Bs {p.montoEncomienda}</td>
                      <td className="px-3 py-2 text-sm text-green-400 font-semibold">
                        Bs {p.montoTotal}
                        {p.estadoReembolso === "REEMBOLSADO" && (
                          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-400/10 text-red-400 align-middle">
                            REEMBOLSADO
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            p.metodoPago === "EFECTIVO"
                              ? "bg-emerald-400/10 text-emerald-400"
                              : "bg-gray-800 text-gray-500"
                          }`}
                        >
                          {p.metodoPago || "EFECTIVO"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleDateString() : "-"}</td>
                    </tr>
                  ))}
                  {filtrados.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-gray-500 text-sm">Sin movimientos</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
