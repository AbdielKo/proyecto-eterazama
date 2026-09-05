import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { useNotificacionesSocket } from "../hooks/useNotificacionesSocket";
import { obtenerNotificaciones } from "../api/pasajero.api";
import {
  Bus, Home, Search, Wallet, Star, Heart,
  User, Bell, HelpCircle, LogOut, ChevronDown, ChevronRight, History, FileText, Sun, Moon
} from "lucide-react";
import { useEffect, useState } from "react";

const menuItems = [
  { to: "/pasajero", label: "Inicio", icon: Home },
  { to: "/pasajero/buscar", label: "Buscar y comprar", icon: Search },
  { to: "/pasajero/mis-pasajes", label: "Mis pasajes", icon: Wallet },
  { to: "/pasajero/boletos", label: "Mis boletos", icon: FileText },
  { to: "/pasajero/historial", label: "Historial", icon: History },
  { to: "/pasajero/resenas", label: "Mis resenas", icon: Star },
  { to: "/pasajero/favoritos", label: "Favoritos", icon: Heart },
  { to: "/pasajero/notificaciones", label: "Notificaciones", icon: Bell },
  { to: "/pasajero/perfil", label: "Perfil", icon: User },
  { to: "/pasajero/ayuda", label: "Ayuda", icon: HelpCircle },
];

export default function PasajeroLayout() {
  const { usuario, logout } = useAuth();
  const { tema, toggleTema } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);

  async function cargarNoLeidas() {
    try {
      const data = await obtenerNotificaciones();
      setNoLeidas(data.filter((n) => !n.leida).length);
    } catch {
      // Sin token o error de red: se ignora, el badge queda como estaba.
    }
  }

  // Contador al entrar/recargar y en tiempo real cuando llega una notificación.
  useEffect(() => {
    cargarNoLeidas();
  }, []);

  useNotificacionesSocket(() => {
    cargarNoLeidas();
  });

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
        <Link to="/pasajero" className="flex items-center gap-2 text-sky-400 font-bold text-lg">
          <Bus className="w-5 h-5" />
          <span className="hidden sm:inline">Trans Eterazama</span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTema}
            title={tema === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
            className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            {tema === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <Link to="/pasajero/notificaciones" className="relative p-2 text-gray-400 hover:text-white transition-colors">
            <Bell className="w-5 h-5" />
            {noLeidas > 0 && (
              <span className="absolute top-0 right-0 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {noLeidas > 99 ? "99+" : noLeidas}
              </span>
            )}
          </Link>
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-750 px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer"
            >
              <div className="w-7 h-7 bg-sky-600/20 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-sky-400" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-white text-xs font-medium leading-tight">{usuario?.nombre || usuario?.nombreUsuario}</p>
                <p className="text-gray-500 text-[10px] leading-tight">Pasajero</p>
              </div>
              {showUserMenu ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
            </button>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 w-48 py-1">
                  <Link to="/pasajero/perfil" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors">
                    <User className="w-4 h-4" /> Mi Perfil
                  </Link>
                  <hr className="border-gray-700 my-1" />
                  <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-gray-700 transition-colors w-full cursor-pointer">
                    <LogOut className="w-4 h-4" /> Cerrar sesion
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-52 bg-gray-900 border-r border-gray-800 p-3 flex flex-col gap-0.5 overflow-y-auto shrink-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive ? "bg-sky-600/15 text-sky-400 font-medium" : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.label === "Notificaciones" && noLeidas > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {noLeidas > 99 ? "99+" : noLeidas}
                  </span>
                )}
              </Link>
            );
          })}
        </aside>

        <main className="flex-1 p-5 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
