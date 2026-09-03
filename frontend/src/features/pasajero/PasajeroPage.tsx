import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { LayoutDashboard, Car, Star, MapPin, LogOut } from "lucide-react";
import ListaVehiculos from "./ListaVehiculos";

export default function PasajeroPage() {
  const [seccion, setSeccion] = useState<"inicio" | "vehiculos">("inicio");
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-2 text-sky-400 font-bold text-lg">
          <Car className="w-6 h-6" />
          Trans Eterazama
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full uppercase tracking-wider">
            Pasajero
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className="w-60 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-1">
          <button
            onClick={() => setSeccion("inicio")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors cursor-pointer ${
              seccion === "inicio" ? "bg-sky-600/20 text-sky-400 font-medium" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Inicio
          </button>
          <button
            onClick={() => setSeccion("vehiculos")}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors cursor-pointer ${
              seccion === "vehiculos" ? "bg-sky-600/20 text-sky-400 font-medium" : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <Car className="w-5 h-5" />
            Buscar Trufis
          </button>
        </aside>

        <main className="flex-1 p-6 overflow-auto">
          {seccion === "inicio" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-white">Panel Pasajero</h1>
                <p className="text-gray-400 mt-1">Busca trufis y compra tus pasajes</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <button
                  onClick={() => setSeccion("vehiculos")}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-sky-500/50 transition-all group cursor-pointer"
                >
                  <Car className="w-10 h-10 text-sky-400 mb-3" />
                  <h3 className="font-semibold text-white group-hover:text-sky-400 transition-colors">Buscar Trufis</h3>
                  <p className="text-sm text-gray-500 mt-1">Ver vehiculos disponibles por parada</p>
                </button>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <MapPin className="w-10 h-10 text-emerald-400 mb-3" />
                  <h3 className="font-semibold text-white">Cochabamba</h3>
                  <p className="text-sm text-gray-500 mt-1">Trufis con destino a la ciudad</p>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <Star className="w-10 h-10 text-yellow-400 mb-3" />
                  <h3 className="font-semibold text-white">Calificar Viaje</h3>
                  <p className="text-sm text-gray-500 mt-1">Deja tu opinion sobre el servicio</p>
                </div>
              </div>
            </div>
          )}

          {seccion === "vehiculos" && <ListaVehiculos />}
        </main>
      </div>
    </div>
  );
}
