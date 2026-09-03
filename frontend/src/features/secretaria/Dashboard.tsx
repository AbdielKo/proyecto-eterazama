import { useEffect, useState } from "react";
import { obtenerVehiculos } from "../../api/flota.api";
import { obtenerCajaSecretaria, obtenerNomina, obtenerVentasSecretaria, type CajaSecretaria, type NominaItem } from "../../api/secretaria.api";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import { Car, MapPin, DollarSign, ClipboardList, Star, TrendingUp, Users, Package, Calendar, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function Dashboard() {
  const [vehiculos, setVehiculos] = useState<{ paradaActual?: string }[]>([]);
  const [caja, setCaja] = useState<CajaSecretaria>({ totalBoletosEmitidos: 0, totalVentas: 0, subtotalAsientos: 0, subtotalEncomiendas: 0, montoTotalCaja: 0 });
  const [nomina, setNomina] = useState<NominaItem[]>([]);
  const [ventas, setVentas] = useState<{ montoTotal: number; fechaCreacion?: string }[]>([]);
  const [periodo, setPeriodo] = useState("dia");

  async function cargarTodo() {
    const [v, c, n, ventasData] = await Promise.all([
      obtenerVehiculos().catch(() => []),
      obtenerCajaSecretaria().catch(() => null),
      obtenerNomina().catch(() => []),
      obtenerVentasSecretaria({ periodo }).catch(() => ({ ventas: [] })),
    ]);
    if (v) setVehiculos(v);
    if (c) setCaja(c);
    setNomina(n);
    if (ventasData?.ventas) setVentas(ventasData.ventas);
  }

  useFlotaSocket(cargarTodo);

  useEffect(() => {
    cargarTodo();
  }, [periodo]);

  const cochabamba = vehiculos.filter((v) => v.paradaActual === "cochabamba").length;
  const eterazama = vehiculos.filter((v) => v.paradaActual === "eterazama").length;
  const enRuta = vehiculos.filter((v) => v.paradaActual === "en_ruta" || v.paradaActual === "fuera_de_fila").length;
  const totalChoferes = nomina.length;

  const totalRecaudado = ventas.reduce((a, p) => a + (p.montoTotal || 0), 0);
  const totalPasajeros = ventas.length;

  const promedioCalificacion =
    nomina.length > 0
      ? Number(
          (
            nomina.reduce((a, c) => a + (c.promedioCalificacion || 0), 0) /
            nomina.length
          ).toFixed(2)
        )
      : 0;
  const totalResenas = nomina.reduce((a, c) => a + (c.cantidadResenas || 0), 0);

  const ventasPorDia: Record<string, number> = {};
  ventas.forEach((p) => {
    if (p.fechaCreacion) {
      const key = new Date(p.fechaCreacion).toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit" });
      ventasPorDia[key] = (ventasPorDia[key] || 0) + (p.montoTotal || 0);
    }
  });
  const chartData = Object.entries(ventasPorDia).map(([fecha, total]) => ({ fecha, total }));

  const pieData = [
    { name: "Pasajes", value: caja.subtotalAsientos, color: "#0ea5e9" },
    { name: "Encomiendas", value: caja.subtotalEncomiendas, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  const stats = [
    { label: "Vehiculos", value: vehiculos.length, icon: Car, color: "text-sky-400 bg-sky-400/10" },
    { label: "Cochabamba", value: cochabamba, icon: MapPin, color: "text-emerald-400 bg-emerald-400/10" },
    { label: "Eterazama", value: eterazama, icon: MapPin, color: "text-amber-400 bg-amber-400/10" },
    { label: "En ruta", value: enRuta, icon: TrendingUp, color: "text-purple-400 bg-purple-400/10" },
    { label: "Choferes", value: totalChoferes, icon: Users, color: "text-pink-400 bg-pink-400/10" },
    { label: "Ventas en periodo", value: totalPasajeros, icon: ClipboardList, color: "text-cyan-400 bg-cyan-400/10" },
    { label: "Total recaudado", value: `Bs ${totalRecaudado}`, icon: DollarSign, color: "text-green-400 bg-green-400/10" },
    { label: "Encomiendas", value: `Bs ${caja.subtotalEncomiendas}`, icon: Package, color: "text-orange-400 bg-orange-400/10" },
    { label: "Calificacion", value: promedioCalificacion, icon: Star, color: "text-yellow-400 bg-yellow-400/10" },
    { label: "Resenas", value: totalResenas, icon: BarChart3, color: "text-indigo-400 bg-indigo-400/10" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Principal</h1>
          <p className="text-gray-400 text-sm mt-0.5">Resumen general del sindicato</p>
        </div>
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
          {["dia", "semana", "mes"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                periodo === p ? "bg-sky-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {p === "dia" ? "Dia" : p === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-[11px] text-gray-500 leading-tight">{s.label}</p>
              </div>
              <p className="text-xl font-bold text-white">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" /> Ingresos por dia
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <Bar dataKey="total" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Bs" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-10">Sin datos en este periodo</p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-green-400" /> Distribucion de ingresos
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: Bs ${value}`}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: "8px", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-10">Sin datos</p>
          )}
        </div>
      </div>
    </div>
  );
}
