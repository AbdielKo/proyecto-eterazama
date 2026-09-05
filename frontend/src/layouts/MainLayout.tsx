import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import {
  Bus, LayoutDashboard, MapPin, Ticket, DollarSign,
  ClipboardList, Users, Star, BarChart3, FileText, Settings,
  User, LogOut, ChevronDown, ChevronRight, Sun, Moon, Maximize, Minimize,
  Undo2, Activity
} from "lucide-react";
import { useEffect, useState } from "react";
import { obtenerNotificacionesSecretaria } from "../api/secretaria.api";
import { useNotificacionesSecretariaSocket } from "../hooks/useNotificacionesSecretariaSocket";
import { Bell } from "lucide-react";

const menuItems = [
  { to: "/secretaria", label: "Dashboard", icon: LayoutDashboard },
  { to: "/secretaria/fila", label: "Filas y Paradas", icon: MapPin },
  { to: "/secretaria/choferes-activos", label: "Choferes activos", icon: Activity },
  { to: "/secretaria/boleteria", label: "Boleteria", icon: Ticket },
  { to: "/secretaria/caja", label: "Caja Central", icon: DollarSign },
  { to: "/secretaria/historial", label: "Historial Ventas", icon: ClipboardList },
  { to: "/secretaria/choferes", label: "Nomina Choferes", icon: Users },
  { to: "/secretaria/usuarios", label: "Usuarios", icon: User },
  { to: "/secretaria/calificaciones", label: "Calificaciones", icon: Star },
  { to: "/secretaria/graficas", label: "Graficas Reviews", icon: BarChart3 },
  { to: "/secretaria/reportes", label: "Reportes", icon: FileText },
  { to: "/secretaria/reembolsos", label: "Reembolsos", icon: Undo2 },
  { to: "/secretaria/notificaciones", label: "Notificaciones", icon: Bell },
  { to: "/secretaria/configuracion", label: "Configuracion", icon: Settings },
];

export default function MainLayout() {
  const { usuario, logout } = useAuth();
  const { tema, toggleTema } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [noLeidas, setNoLeidas] = useState(0);

  function cargarNoLeidas() {
    obtenerNotificacionesSecretaria()
      .then((ns) => setNoLeidas(ns.filter((n) => !n.leida).length))
      .catch(console.error);
  }

  useNotificacionesSecretariaSocket(cargarNoLeidas);

  useEffect(() => {
    cargarNoLeidas();
  }, []);

  useEffect(() => {
    function onCambio() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onCambio);
    return () => document.removeEventListener("fullscreenchange", onCambio);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950">
      <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-4 shrink-0">
        <Link to="/secretaria" className="flex items-center gap-2 text-sky-400 font-bold text-lg">
          <Bus className="w-5 h-5" />
          <span className="hidden sm:inline">Trans Eterazama</span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleTema}
            title={tema === "dark" ? "Activar tema claro" : "Activar tema oscuro"}
            className="p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            {tema === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
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
              <p className="text-gray-500 text-[10px] leading-tight">Secretaria</p>
            </div>
            {showUserMenu ? <ChevronDown className="w-3 h-3 text-gray-500" /> : <ChevronRight className="w-3 h-3 text-gray-500" />}
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 w-48 py-1">
                <Link
                  to="/secretaria/perfil"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                >
                  <User className="w-4 h-4" /> Mi Perfil
                </Link>
                <hr className="border-gray-700 my-1" />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-gray-700 transition-colors w-full cursor-pointer"
                >
                  <LogOut className="w-4 h-4" /> Cerrar sesion
                </button>
              </div>
            </>
          )}
        </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-56 bg-gray-900 border-r border-gray-800 p-3 flex flex-col gap-0.5 overflow-y-auto shrink-0">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-sky-600/15 text-sky-400 font-medium"
                    : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.to === "/secretaria/notificaciones" && noLeidas > 0 && (
                  <span className="ml-auto text-[10px] bg-sky-600 text-white w-5 h-5 rounded-full flex items-center justify-center">
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
