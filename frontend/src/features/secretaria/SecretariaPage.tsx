import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { obtenerVehiculos } from "../../api/flota.api";
import { obtenerVentasDelDia } from "../../api/pasajes.api";
import { obtenerEstadisticasReviews } from "../../api/reviews.api";
import type { Vehiculo } from "../../types/vehiculo";
import type { VentasDiaData } from "../../types/pasaje";
import type { EstadisticasReviews } from "../../types/review";
import { Car, MapPin, DollarSign, ClipboardList, Star } from "lucide-react";

export default function SecretariaPage() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [ventas, setVentas] = useState<VentasDiaData>({ totalVentasHoy: 0, montoTotalHoy: 0 });
  const [reviews, setReviews] = useState<EstadisticasReviews>({ promedio: 0, total: 0 });

  useEffect(() => {
    obtenerVehiculos().then(setVehiculos).catch(console.error);
    obtenerVentasDelDia().then(setVentas).catch(console.error);
    obtenerEstadisticasReviews().then(setReviews).catch(console.error);
  }, []);

  const cochabamba = vehiculos.filter((v) => v.paradaActual === "cochabamba").length;
  const eterazama = vehiculos.filter((v) => v.paradaActual === "eterazama").length;

  const stats = [
    { label: "Vehiculos", value: vehiculos.length, sub: "Registrados", icon: Car, color: "text-sky-400 bg-sky-400/10" },
    { label: "Cochabamba", value: cochabamba, sub: "En parada", icon: MapPin, color: "text-emerald-400 bg-emerald-400/10" },
    { label: "Eterazama", value: eterazama, sub: "En parada", icon: MapPin, color: "text-amber-400 bg-amber-400/10" },
    { label: "Ventas hoy", value: `Bs ${ventas.montoTotalHoy || 0}`, sub: "Ingresos", icon: DollarSign, color: "text-green-400 bg-green-400/10" },
    { label: "Pasajes vendidos", value: ventas.totalVentasHoy || 0, sub: "Hoy", icon: ClipboardList, color: "text-purple-400 bg-purple-400/10" },
    { label: "Calificacion", value: reviews.promedio || 0, sub: `${reviews.total || 0} opiniones`, icon: Star, color: "text-yellow-400 bg-yellow-400/10" },
  ];

  const links = [
    { to: "/secretaria/flota", label: "Gestion de Flota", icon: "🚍", desc: "Administrar vehiculos" },
    { to: "/secretaria/fila", label: "Paradas y Filas", icon: "📍", desc: "Control de paradas" },
    { to: "/secretaria/caja", label: "Caja Central", icon: "💰", desc: "Resumen financiero" },
    { to: "/secretaria/historial", label: "Historial Ventas", icon: "📋", desc: "Registro de ventas" },
    { to: "/secretaria/choferes", label: "Nomina Choferes", icon: "👨‍✈️", desc: "Gestion de choferes" },
    { to: "/secretaria/graficas", label: "Estadisticas", icon: "⭐", desc: "Reviews y graficas" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard Secretaria</h1>
        <p className="text-gray-400 mt-1">Gestion general del Sindicato Trans Eterazama</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">{s.label}</p>
                  <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Accesos rapidos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-sky-500/50 hover:bg-gray-900/80 transition-all group"
            >
              <div className="text-3xl mb-3">{link.icon}</div>
              <h3 className="font-semibold text-white group-hover:text-sky-400 transition-colors">{link.label}</h3>
              <p className="text-sm text-gray-500 mt-1">{link.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
