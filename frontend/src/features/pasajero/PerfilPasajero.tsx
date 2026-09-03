import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { User, Save, Lock, CheckCircle, AlertCircle } from "lucide-react";

export default function PerfilPasajero() {
  const { usuario } = useAuth();
  const [datos, setDatos] = useState({
    nombre: usuario?.nombre || "",
    apellido: usuario?.apellidos || "",
    email: usuario?.gmail || "",
    telefono: usuario?.telefono || "",
  });
  const [password, setPassword] = useState({ actual: "", nueva: "", confirmar: "" });
  const [exito, setExito] = useState("");
  const [error, setError] = useState("");

  function guardarDatos(e: React.FormEvent) {
    e.preventDefault();
    setExito("Datos actualizados correctamente");
    setError("");
    setTimeout(() => setExito(""), 3000);
  }

  function cambiarPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.nueva !== password.confirmar) {
      setError("Las contrasenas no coinciden");
      return;
    }
    if (password.nueva.length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres");
      return;
    }
    setExito("Contrasena cambiada correctamente");
    setError("");
    setPassword({ actual: "", nueva: "", confirmar: "" });
    setTimeout(() => setExito(""), 3000);
  }

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Mi Perfil</h1>
        <p className="text-gray-400 text-sm mt-0.5">Gestiona tus datos personales</p>
      </div>

      {exito && <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm"><CheckCircle className="w-4 h-4 shrink-0" /> {exito}</div>}
      {error && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 bg-sky-600/20 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-sky-400" />
          </div>
          <div>
            <p className="text-white font-semibold">{usuario?.nombre || usuario?.nombreUsuario}</p>
            <p className="text-xs text-gray-400">{usuario?.gmail}</p>
          </div>
        </div>

        <form onSubmit={guardarDatos} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Nombre</label>
              <input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Apellido</label>
              <input value={datos.apellido} onChange={(e) => setDatos({ ...datos, apellido: e.target.value })} placeholder="Opcional" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Correo</label>
            <input type="email" value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Telefono</label>
            <input value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <button type="submit" className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer">
            <Save className="w-4 h-4" /> Guardar cambios
          </button>
        </form>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-amber-400" /> Cambiar contrasena
        </h3>
        <form onSubmit={cambiarPassword} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Contrasena actual</label>
            <input type="password" value={password.actual} onChange={(e) => setPassword({ ...password, actual: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nueva contrasena</label>
            <input type="password" value={password.nueva} onChange={(e) => setPassword({ ...password, nueva: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Confirmar contrasena</label>
            <input type="password" value={password.confirmar} onChange={(e) => setPassword({ ...password, confirmar: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>
          <button type="submit" className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer">
            <Lock className="w-4 h-4" /> Cambiar contrasena
          </button>
        </form>
      </div>
    </div>
  );
}
