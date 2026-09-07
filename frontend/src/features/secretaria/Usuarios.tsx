import { useEffect, useState } from "react";
import api from "../../api/axios";
import { asignarRolChofer, desbloquearCuenta } from "../../api/secretaria.api";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import { Search, Users, UserCheck, UserX, ChevronDown, ChevronUp, ShieldCheck, Lock, Clock, Unlock } from "lucide-react";

interface UsuarioItem {
  id: string;
  nombreUsuario: string;
  nombre?: string;
  apellidos?: string;
  gmail?: string;
  telefono?: string;
  ci?: string;
  rol: string;
  placaAsignada?: string;
  estado?: string;
  fechaRegistro?: string;
  intentosFallidos?: number;
  nivelBloqueo?: number;
  bloqueoTemporalHasta?: string | null;
  cuentaBloqueada?: boolean;
}

interface ModalDesbloqueo {
  abierto: boolean;
  usuario: UsuarioItem | null;
}

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("todos");
  const [ordenar, setOrdenar] = useState<"asc" | "desc">("desc");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState<ModalDesbloqueo>({ abierto: false, usuario: null });
  const [desbloqueando, setDesbloqueando] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());

  async function cargar() {
    try {
      const res = await api.get("/auth/usuarios");
      setUsuarios(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  useFlotaSocket(cargar);

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    const hayBloqueo = usuarios.some(
      (u) => u.cuentaBloqueada || (u.bloqueoTemporalHasta && new Date(u.bloqueoTemporalHasta).getTime() > Date.now())
    );
    if (!hayBloqueo) return;
    const id = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(id);
  }, [usuarios]);

  async function hacerChofer(id: string) {
    setMensaje("");
    setError("");
    try {
      await asignarRolChofer(id);
      setMensaje("Se asignó el rol de chofer. (La secretaría solo puede asignar chofer).");
      cargar();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al asignar el rol.");
    }
  }

  function tiempoRestante(hasta: string): string {
    const ms = Math.max(0, new Date(hasta).getTime() - ahora.getTime());
    const totalMin = Math.floor(ms / 60000);
    const mm = totalMin;
    const ss = Math.floor((ms % 60000) / 1000);
    return `${mm}m ${String(ss).padStart(2, "0")}s`;
  }

  function estadoSeguridad(u: UsuarioItem): { etiqueta: string; clases: string; icono: React.ReactNode } {
    if (u.cuentaBloqueada) {
      return {
        etiqueta: "Cuenta bloqueada",
        clases: "bg-red-500/10 text-red-400 border-red-500/30",
        icono: <Lock className="w-3 h-3" />,
      };
    }
    if (u.bloqueoTemporalHasta && new Date(u.bloqueoTemporalHasta).getTime() > ahora.getTime()) {
      return {
        etiqueta: `Bloqueo temporal (${tiempoRestante(u.bloqueoTemporalHasta)})`,
        clases: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        icono: <Clock className="w-3 h-3" />,
      };
    }
    return {
      etiqueta: "Normal",
      clases: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      icono: <ShieldCheck className="w-3 h-3" />,
    };
  }

  async function confirmarDesbloqueo() {
    if (!modal.usuario) return;
    setDesbloqueando(true);
    setError("");
    setMensaje("");
    try {
      const res = await desbloquearCuenta(modal.usuario.id);
      setMensaje(res.mensaje || "Cuenta desbloqueada correctamente.");
      setModal({ abierto: false, usuario: null });
      cargar();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al desbloquear la cuenta.");
    } finally {
      setDesbloqueando(false);
    }
  }

  const filtrados = usuarios
    .filter((u) => {
      const matchBusqueda =
        u.nombreUsuario?.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.apellidos?.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.gmail?.toLowerCase().includes(busqueda.toLowerCase()) ||
        u.telefono?.includes(busqueda) ||
        u.ci?.includes(busqueda);
      const matchRol = filtroRol === "todos" || u.rol === filtroRol;
      return matchBusqueda && matchRol;
    })
    .sort((a, b) => {
      const fechaA = a.fechaRegistro ? new Date(a.fechaRegistro).getTime() : 0;
      const fechaB = b.fechaRegistro ? new Date(b.fechaRegistro).getTime() : 0;
      return ordenar === "desc" ? fechaB - fechaA : fechaA - fechaB;
    });

  const totalActivos = usuarios.filter((u) => u.estado !== "inactivo").length;
  const totalChoferes = usuarios.filter((u) => u.rol === "chofer").length;
  const totalBloqueadas = usuarios.filter((u) => u.cuentaBloqueada).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Administracion de Usuarios</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Gestiona los usuarios. La secretaria solo puede asignar el rol de chofer y desbloquear cuentas.
          </p>
        </div>
      </div>

      {mensaje && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">
          <UserCheck className="w-4 h-4 shrink-0" /> {mensaje}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: "Total usuarios", value: usuarios.length, color: "text-sky-400 bg-sky-400/10" },
          { label: "Activos", value: totalActivos, color: "text-emerald-400 bg-emerald-400/10" },
          { label: "Choferes", value: totalChoferes, color: "text-amber-400 bg-amber-400/10" },
          { label: "Cuentas bloqueadas", value: totalBloqueadas, color: "text-red-400 bg-red-400/10" },
        ].map((s) => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <Users className={`w-5 h-5 ${s.color.split(" ")[0]}`} />
            <div>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xl font-bold text-white">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nombre, usuario, CI, email o telefono..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
          />
        </div>
        <select
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="todos">Todos los roles</option>
          <option value="chofer">Choferes</option>
          <option value="usuario">Pasajeros</option>
        </select>
        <button
          onClick={() => setOrdenar(ordenar === "desc" ? "asc" : "desc")}
          className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors cursor-pointer"
        >
          {ordenar === "desc" ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          Fecha
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No se encontraron usuarios</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Usuario</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Nombre</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-4 py-3">CI</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Rol</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Telefono</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Placa</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Estado</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Seguridad</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase tracking-wider px-4 py-3">Accion</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => {
                  const seg = estadoSeguridad(u);
                  return (
                    <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="px-4 py-3 text-sm text-white font-medium">{u.nombreUsuario}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{u.nombre} {u.apellidos}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{u.ci || "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          u.rol === "secretaria" ? "bg-purple-400/10 text-purple-400" :
                          u.rol === "chofer" ? "bg-amber-400/10 text-amber-400" :
                          "bg-sky-400/10 text-sky-400"
                        }`}>
                          {u.rol}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">{u.telefono || "-"}</td>
                      <td className="px-4 py-3 text-sm text-sky-400 font-mono">{u.placaAsignada || "-"}</td>
                      <td className="px-4 py-3">
                        {u.estado === "inactivo" ? (
                          <span className="flex items-center gap-1 text-[11px] text-red-400">
                            <UserX className="w-3 h-3" /> Inactivo
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                            <UserCheck className="w-3 h-3" /> Activo
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border ${seg.clases}`}>
                          {seg.icono} {u.cuentaBloqueada ? seg.etiqueta : `Nivel ${u.nivelBloqueo || 0}`}
                        </span>
                        {u.cuentaBloqueada && (
                          <div className="text-[10px] text-red-500/80 mt-0.5">{seg.etiqueta}</div>
                        )}
                        {!u.cuentaBloqueada && u.bloqueoTemporalHasta && new Date(u.bloqueoTemporalHasta).getTime() > ahora.getTime() && (
                          <div className="text-[10px] text-amber-500/80 mt-0.5">{seg.etiqueta}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1.5">
                          {u.rol !== "secretaria" && u.rol !== "chofer" && (
                            <button
                              onClick={() => hacerChofer(u.id)}
                              className="flex items-center gap-1 bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> Hacer chofer
                            </button>
                          )}
                          {u.rol === "chofer" && (
                            <span className="text-[11px] text-gray-500">Ya es chofer</span>
                          )}
                          {u.rol === "secretaria" && (
                            <span className="text-[11px] text-gray-600">No editable</span>
                          )}
                          {u.cuentaBloqueada && (
                            <button
                              onClick={() => setModal({ abierto: true, usuario: u })}
                              className="flex items-center gap-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                            >
                              <Unlock className="w-3.5 h-3.5" /> Desbloquear cuenta
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal.abierto && modal.usuario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-red-500/10 rounded-xl">
                <Lock className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Desbloquear cuenta</h2>
                <p className="text-sm text-gray-400">Usuario: {modal.usuario.nombreUsuario}</p>
              </div>
            </div>
            <p className="text-sm text-gray-300">
              ¿Deseas desbloquear esta cuenta? Se restablecerá su acceso y se eliminarán todos los intentos fallidos registrados.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setModal({ abierto: false, usuario: null })}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarDesbloqueo}
                disabled={desbloqueando}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
              >
                {desbloqueando ? (
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                {desbloqueando ? "Desbloqueando..." : "Sí, desbloquear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}