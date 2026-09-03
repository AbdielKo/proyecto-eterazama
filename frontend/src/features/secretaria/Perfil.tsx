import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/axios";
import { User, Save, Eye, EyeOff, CheckCircle } from "lucide-react";

export default function Perfil() {
  const { usuario } = useAuth();
  const [nombre, setNombre] = useState(usuario?.nombre || "");
  const [apellidos, setApellidos] = useState(usuario?.apellidos || "");
  const [gmail, setGmail] = useState(usuario?.gmail || "");
  const [telefono, setTelefono] = useState(usuario?.telefono || "");

  const [passwordNueva, setPasswordNueva] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState("");
  const [error, setError] = useState("");

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    setExito("");
    setError("");
    try {
      setGuardando(true);
      if (usuario?.id) {
        await api.patch(`/auth/chofer/${usuario.id}`, { nombre, apellidos, gmail, telefono });
      }
      setExito("Datos actualizados correctamente");
    } catch {
      setError("Error al guardar los datos");
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    setExito("");
    setError("");

    if (passwordNueva.length < 6) {
      setError("La nueva contrasena debe tener minimo 6 caracteres");
      return;
    }

    try {
      setGuardando(true);
      if (usuario?.id) {
        await api.post(`/auth/restablecer/${usuario.id}`, { nuevaPassword: passwordNueva });
      }
      setPasswordNueva("");
      setExito("Contrasena cambiada correctamente");
    } catch {
      setError("Error al cambiar contrasena");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
        <p className="text-gray-400 text-sm mt-0.5">Administra tu informacion personal</p>
      </div>

      {exito && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> {exito}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-sky-600/20 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-sky-400" />
          </div>
          <div>
            <p className="text-white font-semibold">{usuario?.nombre || usuario?.nombreUsuario}</p>
            <p className="text-sm text-gray-500">{usuario?.rol}</p>
          </div>
        </div>

        <form onSubmit={guardarDatos} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nombre</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Apellidos</label>
              <input
                value={apellidos}
                onChange={(e) => setApellidos(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={gmail}
                onChange={(e) => setGmail(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Telefono</label>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={guardando}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" /> {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Cambiar contrasena</h2>
        <form onSubmit={cambiarPassword} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nueva contrasena</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                placeholder="Minimo 6 caracteres"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={guardando || !passwordNueva}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <Eye className="w-4 h-4" /> Cambiar contrasena
          </button>
        </form>
      </div>
    </div>
  );
}
