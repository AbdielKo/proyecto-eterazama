import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { obtenerPerfil, actualizarPerfil, cambiarEstadoServicio } from "./chofer.api";
import type { PerfilChofer } from "./chofer.types";
import { User, Mail, Phone, Shield, Calendar, Save, Power, PowerOff } from "lucide-react";

export default function PerfilChofer() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<PerfilChofer | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ nombre: "", apellidos: "", telefono: "" });
  const [guardando, setGuardando] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);

  useEffect(() => {
    obtenerPerfil()
      .then(p => {
        setPerfil(p);
        setForm({ nombre: p.nombre || "", apellidos: p.apellidos || "", telefono: p.telefono || "" });
      })
      .catch(console.error);
  }, []);

  async function handleToggleEstado() {
    if (!perfil) return;
    setCambiandoEstado(true);
    try {
      const siguiente = perfil.estado === "activo" ? "inactivo" : "activo";
      const resultado = await cambiarEstadoServicio(siguiente);
      setPerfil({ ...perfil, estado: resultado.estado });
    } catch (e: any) {
      alert(e?.response?.data?.message || "No se pudo cambiar el estado de servicio.");
    } finally {
      setCambiandoEstado(false);
    }
  }

  async function handleGuardar() {
    setGuardando(true);
    try {
      const actualizado = await actualizarPerfil(form);
      setPerfil(actualizado);
      setEditando(false);
    } catch (e: any) {
      alert(e?.response?.data?.message || "Error al actualizar perfil");
    } finally {
      setGuardando(false);
    }
  }

  function handleCerrarSesion() {
    logout();
    navigate("/");
  }

  if (!perfil) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Mi perfil</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <p className="text-gray-500">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Mi perfil</h1>
        <p className="text-gray-400 mt-1">Tus datos personales</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white">Datos personales</h3>
          {!editando ? (
            <button
              onClick={() => setEditando(true)}
              className="text-sky-400 hover:text-sky-300 text-sm transition-colors cursor-pointer"
            >
              Editar
            </button>
          ) : (
            <button
              onClick={() => { setEditando(false); setForm({ nombre: perfil.nombre || "", apellidos: perfil.apellidos || "", telefono: perfil.telefono || "" }); }}
              className="text-gray-400 hover:text-white text-sm transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-gray-800/50 rounded-xl p-4">
            <User className="w-5 h-5 text-sky-400 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">Nombre</p>
              {editando ? (
                <input
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white mt-1"
                />
              ) : (
                <p className="text-sm text-white mt-1">{perfil.nombre || "Sin nombre"}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 bg-gray-800/50 rounded-xl p-4">
            <User className="w-5 h-5 text-sky-400 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">Apellidos</p>
              {editando ? (
                <input
                  value={form.apellidos}
                  onChange={e => setForm({ ...form, apellidos: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white mt-1"
                />
              ) : (
                <p className="text-sm text-white mt-1">{perfil.apellidos || "Sin apellidos"}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 bg-gray-800/50 rounded-xl p-4">
            <Shield className="w-5 h-5 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Usuario</p>
              <p className="text-sm text-white mt-1">{perfil.nombreUsuario}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-gray-800/50 rounded-xl p-4">
            <Mail className="w-5 h-5 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Correo electronico</p>
              <p className="text-sm text-white mt-1">{perfil.gmail || "Sin correo"}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-gray-800/50 rounded-xl p-4">
            <Phone className="w-5 h-5 text-gray-400 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-gray-500">Telefono</p>
              {editando ? (
                <input
                  value={form.telefono}
                  onChange={e => setForm({ ...form, telefono: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white mt-1"
                />
              ) : (
                <p className="text-sm text-white mt-1">{perfil.telefono || "Sin telefono"}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 bg-gray-800/50 rounded-xl p-4">
            <Calendar className="w-5 h-5 text-gray-400 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Fecha de registro</p>
              <p className="text-sm text-white mt-1">
                {perfil.fechaRegistro ? new Date(perfil.fechaRegistro).toLocaleDateString() : "-"}
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-4 rounded-xl p-4 ${
              perfil.estado === "activo"
                ? "bg-emerald-500/10 border border-emerald-500/30"
                : "bg-red-500/10 border border-red-500/30"
            }`}
          >
            {perfil.estado === "activo" ? (
              <Power className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <PowerOff className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-xs text-gray-500">Estado de servicio</p>
              <p className={`text-sm font-bold mt-1 ${perfil.estado === "activo" ? "text-emerald-400" : "text-red-400"}`}>
                {perfil.estado === "activo" ? "ACTIVO" : "INACTIVO"}
              </p>
            </div>
            <button
              onClick={handleToggleEstado}
              disabled={cambiandoEstado}
              className={`text-xs font-semibold px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                perfil.estado === "activo"
                  ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                  : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
              }`}
            >
              {perfil.estado === "activo" ? "Desactivarme" : "Activarme"}
            </button>
          </div>
        </div>

        {editando && (
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-gray-700 text-white py-2.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        )}
      </div>

      <button
        onClick={handleCerrarSesion}
        className="w-full bg-red-600/10 border border-red-500/30 hover:bg-red-600/20 text-red-400 py-3 rounded-xl font-medium transition-colors cursor-pointer"
      >
        Cerrar sesion
      </button>
    </div>
  );
}
