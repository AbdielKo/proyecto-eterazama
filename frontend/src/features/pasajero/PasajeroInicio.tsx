import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { obtenerVehiculos } from "../../api/flota.api";
import { obtenerPasajes } from "../../api/pasajes.api";
import type { Vehiculo } from "../../types/vehiculo";
import type { Pasaje } from "../../types/pasaje";
import { Search, Ticket, MapPin, Star, Bell } from "lucide-react";

export default function PasajeroInicio() {
  const { usuario } = useAuth();
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [misPasajes, setMisPasajes] = useState<Pasaje[]>([]);

  useEffect(() => {
    Promise.all([
      obtenerVehiculos().catch(() => []),
      obtenerPasajes().catch(() => []),
    ]).then(([v, p]) => {
      setVehiculos(v);
      const nombre = usuario?.nombre || usuario?.nombreUsuario;
      setMisPasajes(p.filter((pas: Pasaje) => pas.pasajeroNombre?.toLowerCase().includes(nombre?.toLowerCase() || "")));
    });
  }, [usuario]);

  const disponibles = vehiculos.filter((v) => v.paradaActual === "cochabamba" || v.paradaActual === "eterazama" || v.paradaActual === "en_ruta");
  const ultimosPasajes = misPasajes.slice(-5).reverse();

  const acciones = [
    { to: "/pasajero/buscar", label: "Buscar viaje", desc: "Encuentra trufis disponibles", icon: Search, color: "text-sky-400 bg-sky-400/10" },
    { to: "/pasajero/comprar", label: "Comprar pasaje", desc: "Compra tu pasaje ahora", icon: Ticket, color: "text-emerald-400 bg-emerald-400/10" },
    { to: "/pasajero/mis-pasajes", label: "Mis pasajes", desc: "Ve tus viajes activos", icon: MapPin, color: "text-amber-400 bg-amber-400/10" },
    { to: "/pasajero/calificar", label: "Calificar", desc: "Califica tu ultimo viaje", icon: Star, color: "text-yellow-400 bg-yellow-400/10" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Hola, {usuario?.nombre || usuario?.nombreUsuario}!</h1>
        <p className="text-gray-400 text-sm mt-0.5">Bienvenido a Trans Eterazama</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {acciones.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.to} to={a.to} className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-sky-500/30 transition-all group">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${a.color} mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold text-white group-hover:text-sky-400 transition-colors">{a.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Ticket className="w-4 h-4 text-sky-400" /> Ultimos pasajes
            </h3>
            <Link to="/pasajero/mis-pasajes" className="text-[11px] text-sky-400 hover:text-sky-300">Ver todos</Link>
          </div>
          {ultimosPasajes.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Sin pasajes recientes</p>
          ) : (
            <div className="space-y-2">
              {ultimosPasajes.map((p) => (
                <div key={p.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">{p.placaVehiculo}</p>
                    <p className="text-xs text-gray-400">{p.tramo} | Asiento {p.asientos?.join(", ")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-400 font-semibold">Bs {p.montoTotal}</p>
                    <p className="text-[10px] text-gray-500">{p.fechaCreacion ? new Date(p.fechaCreacion).toLocaleDateString() : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" /> Vehiculos disponibles
            </h3>
            <Link to="/pasajero/buscar" className="text-[11px] text-sky-400 hover:text-sky-300">Buscar</Link>
          </div>
          {disponibles.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Sin vehiculos disponibles</p>
          ) : (
            <div className="space-y-2">
              {disponibles.slice(0, 5).map((v) => (
                <div key={v.id} className="bg-gray-800 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-sky-400 font-mono font-semibold">{v.placa}</p>
                    <p className="text-xs text-gray-400">{v.choferNombre} | {v.tipoVehiculo}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    v.paradaActual === "cochabamba" ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"
                  }`}>
                    {v.paradaActual === "cochabamba" ? "Cochabamba" : "Eterazama"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-amber-400" /> Avisos del sindicato
        </h3>
        <div className="bg-gray-800 rounded-xl p-4 text-center">
          <p className="text-sm text-gray-400">Bienvenido a la plataforma de boleteria de Trans Eterazama</p>
          <p className="text-xs text-gray-500 mt-1">Consulta horarios y precios en la seccion Buscar Viaje</p>
        </div>
      </div>
    </div>
  );
}
