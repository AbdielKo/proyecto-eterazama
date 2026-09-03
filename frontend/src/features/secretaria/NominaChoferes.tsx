import { useEffect, useState } from "react";
import {
  obtenerNomina,
  crearChofer,
  asignarRolChofer,
  type NominaItem,
} from "../../api/secretaria.api";
import api from "../../api/axios";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import {
  Users,
  Search,
  Star,
  Car,
  Phone,
  IdCard,
  User,
  Plus,
  X,
  UserCheck,
  ShieldAlert,
} from "lucide-react";

interface UsuarioItem {
  id: string;
  nombreUsuario: string;
  nombre?: string;
  apellidos?: string;
  gmail?: string;
  telefono?: string;
  ci?: string;
  rol: string;
  estado?: string;
}

export default function NominaChoferes() {
  const [choferes, setChoferes] = useState<NominaItem[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  // Modal: nuevo chofer
  const [showNuevo, setShowNuevo] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    apellidos: "",
    nombreUsuario: "",
    ci: "",
    telefono: "",
    gmail: "",
    password: "",
    placa: "",
    capacidadTotal: 0,
    tipoVehiculo: "Trufi",
    color: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  // Asignar rol a usuario existente
  const [showAsignar, setShowAsignar] = useState(false);
  const [criterio, setCriterio] = useState("");
  const [sugerencias, setSugerencias] = useState<UsuarioItem[]>([]);
  const [buscandoUsuarios, setBuscandoUsuarios] = useState(false);

  async function cargar() {
    try {
      setCargando(true);
      const datos = await obtenerNomina();
      setChoferes(datos);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useFlotaSocket(cargar);

  useEffect(() => {
    cargar();
  }, []);

  const filtrados = choferes.filter((c) =>
    (c.nombreCompleto || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.placa || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.ci || "").includes(busqueda) ||
    (c.nombreUsuario || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  async function guardarNuevo(e: React.FormEvent) {
    e.preventDefault();
    setMensaje("");
    setError("");

    if (!form.nombreUsuario || form.nombreUsuario.length < 3) {
      setError("El nombre de usuario debe tener al menos 3 caracteres.");
      return;
    }
    if (!form.password || form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.placa && (!form.capacidadTotal || form.capacidadTotal < 4)) {
      setError("Si registra la placa del vehículo, indique la cantidad de asientos (mínimo 4).");
      return;
    }

    try {
      setGuardando(true);
      await crearChofer({
        nombreUsuario: form.nombreUsuario,
        password: form.password,
        nombre: form.nombre || undefined,
        apellidos: form.apellidos || undefined,
        ci: form.ci || undefined,
        telefono: form.telefono || undefined,
        gmail: form.gmail || undefined,
        placa: form.placa.trim() || undefined,
        capacidadTotal: form.placa.trim() ? Number(form.capacidadTotal) : undefined,
        tipoVehiculo: form.placa.trim() ? form.tipoVehiculo || "Trufi" : undefined,
        color: form.placa.trim() ? form.color || undefined : undefined,
      });
      setMensaje("Chofer registrado correctamente. El rol asignado es 'chofer'.");
      setForm({
        nombre: "",
        apellidos: "",
        nombreUsuario: "",
        ci: "",
        telefono: "",
        gmail: "",
        password: "",
        placa: "",
        capacidadTotal: 0,
        tipoVehiculo: "Trufi",
        color: "",
      });
      setShowNuevo(false);
      cargar();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al registrar el chofer.");
    } finally {
      setGuardando(false);
    }
  }

  async function buscarUsuarios() {
    setMensaje("");
    setError("");
    if (!criterio.trim()) return;
    try {
      setBuscandoUsuarios(true);
      const res = await api.get("/auth/usuarios");
      const todos: UsuarioItem[] = res.data;
      const q = criterio.trim().toLowerCase();
      const filtrados = todos.filter(
        (u) =>
          u.rol !== "secretaria" &&
          (u.nombreUsuario?.toLowerCase().includes(q) ||
            u.nombre?.toLowerCase().includes(q) ||
            u.apellidos?.toLowerCase().includes(q) ||
            u.gmail?.toLowerCase().includes(q) ||
            u.telefono?.includes(q))
      );
      setSugerencias(filtrados);
    } catch (e) {
      console.error(e);
      setError("Error al buscar usuarios.");
    } finally {
      setBuscandoUsuarios(false);
    }
  }

  async function hacerChofer(id: string) {
    setMensaje("");
    setError("");
    try {
      await asignarRolChofer(id);
      setMensaje("Rol 'chofer' asignado correctamente.");
      setSugerencias([]);
      setCriterio("");
      setShowAsignar(false);
      cargar();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al asignar el rol.");
    }
  }

  const inputCls =
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Nomina de Choferes</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {choferes.length} choferes registrados en la base de datos
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setShowAsignar(!showAsignar);
              setShowNuevo(false);
            }}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer border border-gray-700"
          >
            <UserCheck className="w-4 h-4" /> Asignar Rol
          </button>
          <button
            onClick={() => {
              setShowNuevo(!showNuevo);
              setShowAsignar(false);
            }}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            {showNuevo ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Nuevo Chofer
          </button>
        </div>
      </div>

      {mensaje && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">
          <UserCheck className="w-4 h-4 shrink-0" /> {mensaje}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {showNuevo && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            Registrar Nuevo Chofer
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            La cuenta se creará automáticamente con el rol de chofer. Si registra placa y asientos, también se creará el vehículo y se vinculará al chofer.
          </p>
          <form onSubmit={guardarNuevo} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <input className={inputCls} placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <input className={inputCls} placeholder="Apellidos" value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} />
            <input className={inputCls} placeholder="CI" value={form.ci} onChange={(e) => setForm({ ...form, ci: e.target.value })} />
            <input className={inputCls} placeholder="Telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            <input className={inputCls} placeholder="Correo (opcional)" value={form.gmail} onChange={(e) => setForm({ ...form, gmail: e.target.value })} />
            <input className={inputCls} placeholder="Nombre de usuario *" value={form.nombreUsuario} onChange={(e) => setForm({ ...form, nombreUsuario: e.target.value })} />
            <input className={inputCls} type="password" placeholder="Contrasena *" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <input className={inputCls} placeholder="Placa del vehiculo" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} />
            <input className={inputCls} type="number" min={4} placeholder="Cantidad de asientos" value={form.capacidadTotal || ""} onChange={(e) => setForm({ ...form, capacidadTotal: Number(e.target.value) })} />
            <input className={inputCls} placeholder="Tipo de vehiculo (Trufi, Minibus...)" value={form.tipoVehiculo} onChange={(e) => setForm({ ...form, tipoVehiculo: e.target.value })} />
            <input className={inputCls} placeholder="Color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            <button
              type="submit"
              disabled={guardando}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors cursor-pointer"
            >
              {guardando ? "Guardando..." : "Registrar Chofer"}
            </button>
          </form>
        </div>
      )}

      {showAsignar && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-1">
            Asignar rol de chofer
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            Busca un usuario existente (no secretaria) y asígnale el rol de chofer.
          </p>
          <div className="flex gap-2 flex-wrap">
            <input
              className={inputCls}
              style={{ maxWidth: "320px" }}
              placeholder="Buscar por nombre, usuario, email o telefono..."
              value={criterio}
              onChange={(e) => {
                setCriterio(e.target.value);
                setSugerencias([]);
              }}
            />
            <button
              onClick={buscarUsuarios}
              disabled={buscandoUsuarios}
              className="bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            >
              {buscandoUsuarios ? "Buscando..." : "Buscar"}
            </button>
          </div>

          {sugerencias.length > 0 && (
            <div className="mt-4 space-y-2">
              {sugerencias.map((u) => (
                <div key={u.id} className="flex items-center justify-between bg-gray-800 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {u.nombre} {u.apellidos}
                    </p>
                    <p className="text-xs text-gray-500">
                      @{u.nombreUsuario} {u.telefono && `| ${u.telefono}`}
                    </p>
                  </div>
                  <button
                    onClick={() => hacerChofer(u.id)}
                    className="flex items-center gap-1 bg-amber-600/20 text-amber-400 hover:bg-amber-600/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Hacer chofer
                  </button>
                </div>
              ))}
            </div>
          )}
          {sugerencias.length === 0 && criterio && (
            <p className="text-xs text-gray-500 mt-3">Sin resultados.</p>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por nombre, placa o CI..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
      </div>

      {cargando ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <p className="text-gray-500 text-sm">Cargando nomina...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No hay choferes registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((c) => (
            <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-white">{c.nombreCompleto}</h3>
                  <p className="text-xs text-gray-500">@{c.nombreUsuario}</p>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    c.estado === "inactivo"
                      ? "bg-red-400/10 text-red-400"
                      : "bg-emerald-400/10 text-emerald-400"
                  }`}
                >
                  {c.estado === "inactivo" ? "INACTIVO" : "ACTIVO"}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-gray-400 mb-3">
                <p className="flex items-center gap-2"><IdCard className="w-3.5 h-3.5 text-gray-500" /> CI: {c.ci || "-"}</p>
                <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-500" /> {c.telefono || "-"}</p>
                <p className="flex items-center gap-2"><Car className="w-3.5 h-3.5 text-gray-500" /> {c.vehiculo || "Sin vehiculo"}</p>
                <p className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-gray-500" /> Placa: <span className="font-mono text-sky-400">{c.placa || "-"}</span></p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <p className="text-[11px] text-gray-500">Viajes</p>
                  <p className="text-sm font-bold text-white">{c.totalViajes}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <p className="text-[11px] text-gray-500">Resenas</p>
                  <p className="text-sm font-bold text-white">{c.cantidadResenas}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <p className="text-[11px] text-gray-500 flex items-center justify-center gap-0.5">
                    <Star className="w-3 h-3 text-yellow-400" /> Promedio
                  </p>
                  <p className="text-sm font-bold text-yellow-400">{c.promedioCalificacion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
