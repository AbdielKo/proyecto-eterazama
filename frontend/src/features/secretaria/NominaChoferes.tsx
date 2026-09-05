import { useEffect, useState } from "react";
import {
  obtenerNomina,
  crearChofer,
  asignarRolChofer,
  obtenerVehiculosSinChofer,
  type NominaItem,
  type VehiculosSinChofer,
} from "../../api/secretaria.api";
import {
  obtenerTiposVehiculo,
  crearTipoVehiculo,
  obtenerVehiculos,
  trasladarVehiculo,
  eliminarVehiculo,
  actualizarVehiculo,
} from "../../api/flota.api";
import type { Vehiculo } from "../../types/vehiculo";
import api from "../../api/axios";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import ConfiguradorAsientos from "./ConfiguradorAsientos";
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
  Check,
  UserCheck,
  ShieldAlert,
  Armchair,
  MapPin,
  ArrowRight,
  Pencil,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
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

interface TipoVehiculo {
  id: number;
  nombre: string;
}

export default function NominaChoferes() {
  const [choferes, setChoferes] = useState<NominaItem[]>([]);
  const [huerfanos, setHuerfanos] = useState<VehiculosSinChofer | null>(null);
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
  const [tipos, setTipos] = useState<TipoVehiculo[]>([]);
  const [nuevoTipo, setNuevoTipo] = useState("");

  // Asignar rol a usuario existente
  const [showAsignar, setShowAsignar] = useState(false);
  const [criterio, setCriterio] = useState("");
  const [sugerencias, setSugerencias] = useState<UsuarioItem[]>([]);
  const [buscandoUsuarios, setBuscandoUsuarios] = useState(false);

  // Gestion de vehiculos dentro de la nomina
  const [configurandoId, setConfigurandoId] = useState<number | null>(null);
  const [detallePlaca, setDetallePlaca] = useState<string | null>(null);
  const [editandoPlaca, setEditandoPlaca] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Vehiculo>>({});
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);

  // Distribución temporal para un NUEVO chofer (antes de registrarlo).
  // Se configura en el diseñador en modo borrador y se persiste al registrar.
  const [distribucion, setDistribucion] = useState<{
    filas: (number | null)[][];
    asientosChofer: number[];
  } | null>(null);
  const [disenadorAbierto, setDisenadorAbierto] = useState(false);
  const [aviso, setAviso] = useState("");

  const totalAsientosConfigurados = distribucion
    ? distribucion.filas.flat().filter((c): c is number => typeof c === "number").length
    : 0;
  const vendiblesConfigurados = distribucion
    ? totalAsientosConfigurados - distribucion.asientosChofer.length
    : 0;

  async function cargar() {
    try {
      setCargando(true);
      const datos = await obtenerNomina();
      setChoferes(datos);
      obtenerVehiculos().then(setVehiculos).catch(console.error);
      obtenerVehiculosSinChofer().then(setHuerfanos).catch(console.error);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useFlotaSocket(cargar);

  useEffect(() => {
    cargar();
    obtenerTiposVehiculo()
      .then((lista: TipoVehiculo[]) => {
        setTipos(lista);
        // El tipo de vehículo por defecto sale de PostgreSQL (primer tipo
        // real), no de una lista fija. Si la secretaria ya eligió un tipo
        // que existe, se respeta su elección.
        if (lista.length > 0) {
          setForm((f) => {
            const existe = lista.some((t) => t.nombre === f.tipoVehiculo);
            return existe ? f : { ...f, tipoVehiculo: lista[0].nombre };
          });
        }
      })
      .catch(console.error);
  }, []);

  async function guardarNuevoTipo() {
    const nombre = nuevoTipo.trim();
    if (!nombre) return;
    try {
      const creado = await crearTipoVehiculo(nombre);
      setTipos((prev) => [...prev, creado]);
      setForm((f) => ({ ...f, tipoVehiculo: creado.nombre }));
      setNuevoTipo("");
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(", ") : (msg || "Error al crear el modelo."));
    }
  }

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

    if (!form.nombre || !form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    if (!form.apellidos || !form.apellidos.trim()) {
      setError("Los apellidos son obligatorios.");
      return;
    }
    if (!form.ci || !form.ci.trim()) {
      setError("El carnet de identidad (CI) es obligatorio.");
      return;
    }
    if (!form.telefono || !form.telefono.trim()) {
      setError("El teléfono es obligatorio.");
      return;
    }
    if (!form.nombreUsuario || form.nombreUsuario.length < 3) {
      setError("El nombre de usuario debe tener al menos 3 caracteres.");
      return;
    }
    if (!form.password || form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (!form.placa || !form.placa.trim()) {
      setError("La placa del vehículo es obligatoria.");
      return;
    }
    if (!form.capacidadTotal || form.capacidadTotal < 4) {
      setError("Indique la cantidad de asientos del vehículo (mínimo 4).");
      return;
    }
    if (!form.tipoVehiculo || !form.tipoVehiculo.trim()) {
      setError("El tipo de vehículo es obligatorio.");
      return;
    }
    if (!form.color || !form.color.trim()) {
      setError("El color del vehículo es obligatorio.");
      return;
    }
    if (!distribucion) {
      setError("Debe configurar la distribución de asientos antes de registrar el chofer.");
      return;
    }
    if (totalAsientosConfigurados !== Number(form.capacidadTotal)) {
      setError(
        `La distribución configurada tiene ${totalAsientosConfigurados} asientos, pero indicó ${form.capacidadTotal}. Abra "[ Editar distribución ]" para ajustarla a la cantidad indicada.`,
      );
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
        placa: form.placa.trim(),
        capacidadTotal: Number(form.capacidadTotal),
        tipoVehiculo: form.tipoVehiculo || "Trufi",
        color: form.color || undefined,
        filas: distribucion?.filas,
        asientosChofer: distribucion?.asientosChofer,
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
        tipoVehiculo: tipos[0]?.nombre || "Trufi",
        color: "",
      });
      setDistribucion(null);
      setDisenadorAbierto(false);
      setAviso("");
      setShowNuevo(false);
      cargar();
    } catch (e: any) {
      setError(
        Array.isArray(e?.response?.data?.message)
          ? e.response.data.message[0]
          : e?.response?.data?.message || "Error al registrar el chofer."
      );
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

  function vehiculoDe(c: NominaItem): Vehiculo | undefined {
    if (!c.placa) return undefined;
    return vehiculos.find((v) => v.placa === c.placa);
  }

  function abrirDisenador(vid: number) {
    setConfigurandoId(vid);
  }

  async function moverVehiculo(c: NominaItem, destino: string) {
    const v = vehiculoDe(c);
    if (!v?.id) return;
    try {
      await trasladarVehiculo(v.id, destino);
      cargar();
    } catch (error) {
      console.error(error);
    }
  }

  async function eliminarVehiculoDe(c: NominaItem) {
    const v = vehiculoDe(c);
    if (!v?.id) return;
    if (!confirm(`Seguro que desea eliminar el vehículo ${c.placa}?`)) return;
    try {
      await eliminarVehiculo(v.id);
      cargar();
    } catch (error) {
      console.error(error);
    }
  }

  function iniciarEdicion(c: NominaItem) {
    const v = vehiculoDe(c);
    setEditandoPlaca(c.placa);
    setEditForm(v ? { ...v } : { placa: c.placa || undefined });
  }

  async function guardarEdicion(c: NominaItem) {
    const v = vehiculoDe(c);
    if (!v?.id) return;
    try {
      await actualizarVehiculo(v.id, editForm);
      setEditandoPlaca(null);
      cargar();
    } catch (error) {
      console.error(error);
    }
  }

  function badgeEstadoVehiculo(estado?: string) {
    if (!estado) return null;
    const colores: Record<string, string> = {
      en_ruta: "bg-sky-400/10 text-sky-400",
      fin_de_ruta: "bg-purple-400/10 text-purple-400",
      mantenimiento: "bg-amber-400/10 text-amber-400",
      inactivo: "bg-red-400/10 text-red-400",
      activo: "bg-emerald-400/10 text-emerald-400",
      listo: "bg-gray-400/10 text-gray-400",
    };
    const etiquetas: Record<string, string> = {
      en_ruta: "EN RUTA",
      fin_de_ruta: "FIN DE RUTA",
      mantenimiento: "MANTENIMIENTO",
      inactivo: "INACTIVO",
      activo: "ACTIVO",
      listo: "LISTO",
    };
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colores[estado] || "bg-gray-400/10 text-gray-400"}`}>
        {etiquetas[estado] || estado}
      </span>
    );
  }

  function paradaLabel(parada?: string) {
    const labels: Record<string, string> = {
      cochabamba: "Cochabamba",
      eterazama: "Eterazama",
      fuera_de_fila: "Fuera de fila",
      en_ruta: "En ruta",
    };
    return labels[parada || ""] || parada || "-";
  }

  function abrirDisenadorDraft() {
    setError("");
    setAviso("");
    setDisenadorAbierto(true);
  }

  // Recibe la distribución configurada en el diseñador (modo borrador) y la
  // conserva en estado temporal del formulario hasta registrar el chofer.
  function manejarGuardarDraft(
    filas: (number | null)[][],
    asientosChofer: number[],
    capacidad: number,
  ) {
    setDistribucion({ filas, asientosChofer });
    setForm((f) => ({ ...f, capacidadTotal: capacidad }));
    setAviso("");
    setDisenadorAbierto(false);
  }

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

      {huerfanos && huerfanos.cantidad > 0 && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-3 rounded-xl text-sm">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <div>
            <p>
              Se encontraron {huerfanos.cantidad}{" "}
              vehículo{huerfanos.cantidad !== 1 ? "s" : ""} sin chofer oficial asociado.{" "}
              {huerfanos.cantidad !== 1 ? "No se muestran" : "No se muestra"} en la
              Boletería ni en la Fila.
            </p>
            {huerfanos.vehiculos.length > 0 && (
              <p className="text-xs text-amber-300/70 mt-1 font-mono">
                {huerfanos.vehiculos.map((v) => v.placa).join(", ")}
              </p>
            )}
          </div>
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
            <div className="flex flex-col gap-2 justify-center">
              {distribucion ? (
                <>
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg px-3 py-2.5 text-sm">
                    <Check className="w-4 h-4" /> Asientos configurados
                  </div>
                  <p className="text-xs text-gray-400">
                    {totalAsientosConfigurados} asientos · {distribucion.asientosChofer.length} chofer · {vendiblesConfigurados} vendibles
                  </p>
                  <button
                    type="button"
                    onClick={abrirDisenadorDraft}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer border border-gray-700"
                  >
                    Editar distribución
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={abrirDisenadorDraft}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Armchair className="w-4 h-4" /> Configurar asientos
                </button>
              )}
              {aviso && <p className="text-xs text-amber-400">{aviso}</p>}
            </div>
            <select className={inputCls} value={form.tipoVehiculo} onChange={(e) => setForm({ ...form, tipoVehiculo: e.target.value })}>
              {tipos.map((t) => (
                <option key={t.id} value={t.nombre}>{t.nombre}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input className={inputCls} placeholder="Nuevo modelo" value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} />
              <button
                type="button"
                onClick={guardarNuevoTipo}
                className="px-3 bg-sky-600/20 text-sky-400 rounded-lg text-sm font-medium hover:bg-sky-600/30 transition-colors cursor-pointer whitespace-nowrap"
                title="Agregar nuevo modelo"
              >
                + Agregar
              </button>
            </div>
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
                {c.placa ? (
                  <>
                    <p className="flex items-center gap-2"><Car className="w-3.5 h-3.5 text-gray-500" /> {c.vehiculo || "Vehículo"} {badgeEstadoVehiculo(c.estadoVehiculo)}</p>
                    <p className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-gray-500" /> Placa: <span className="font-mono text-sky-400">{c.placa}</span></p>
                    <p className="flex items-center gap-2"><Armchair className="w-3.5 h-3.5 text-gray-500" /> Asientos: {c.capacidadTotal ?? "-"}</p>
                    <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-500" /> Parada: {paradaLabel(c.paradaActual)}</p>
                  </>
                ) : (
                  <p className="flex items-center gap-2"><Car className="w-3.5 h-3.5 text-gray-500" /> Sin vehiculo</p>
                )}
              </div>

              {c.placa && detallePlaca === c.placa && !editandoPlaca && (
                <div className="mt-2 mb-3 bg-gray-800 rounded-xl p-3 text-[11px] text-gray-400 space-y-1">
                  <p><span className="text-gray-500">Tipo/Modelo:</span> {c.tipoVehiculo || "-"}</p>
                  <p><span className="text-gray-500">Color:</span> {c.color || "-"}</p>
                  <p><span className="text-gray-500">Capacidad:</span> {c.capacidadTotal ?? "-"} asientos</p>
                  <p><span className="text-gray-500">Estado vehiculo:</span> {c.estadoVehiculo || "-"}</p>
                </div>
              )}

              {c.placa && editandoPlaca === c.placa && (
                <div className="mt-2 mb-3 bg-gray-800 rounded-xl p-3 space-y-1.5">
                  <input className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white" placeholder="Tipo/Modelo" value={editForm.tipoVehiculo || ""} onChange={(e) => setEditForm({ ...editForm, tipoVehiculo: e.target.value })} />
                  <input className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white" placeholder="Color" value={editForm.color || ""} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} />
                  <input type="number" min={4} className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white" placeholder="Cantidad de asientos" value={editForm.capacidadTotal || ""} onChange={(e) => setEditForm({ ...editForm, capacidadTotal: Number(e.target.value) })} />
                  <button onClick={() => guardarEdicion(c)} className="w-full flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-1 text-xs cursor-pointer">
                    <Save className="w-3 h-3" /> Guardar vehiculo
                  </button>
                </div>
              )}

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

              {c.placa && c.vehiculoId && (
                <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3">
                  <button
                    onClick={() => setDetallePlaca(detallePlaca === c.placa ? null : c.placa!)}
                    className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 cursor-pointer"
                  >
                    Detalles {detallePlaca === c.placa ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => abrirDisenador(c.vehiculoId!)}
                      className="p-1.5 bg-violet-600/20 text-violet-400 rounded-lg hover:bg-violet-600/30 transition-colors cursor-pointer"
                      title="Disenar asientos"
                    >
                      <Armchair className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => (editandoPlaca === c.placa ? setEditandoPlaca(null) : iniciarEdicion(c))}
                      className="p-1.5 bg-amber-600/20 text-amber-400 rounded-lg hover:bg-amber-600/30 transition-colors cursor-pointer"
                      title="Editar vehiculo"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moverVehiculo(c, c.paradaActual === "eterazama" ? "cochabamba" : "eterazama")}
                      className="p-1.5 bg-sky-600/20 text-sky-400 rounded-lg hover:bg-sky-600/30 transition-colors cursor-pointer"
                      title="Cambiar de parada"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => eliminarVehiculoDe(c)}
                      className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors cursor-pointer"
                      title="Eliminar vehiculo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {configurandoId !== null && (
        <ConfiguradorAsientos
          vehiculoId={configurandoId}
          onCerrado={() => { setConfigurandoId(null); cargar(); }}
        />
      )}

      {disenadorAbierto && (
        <ConfiguradorAsientos
          capacidadInicial={distribucion ? totalAsientosConfigurados : undefined}
          filasIniciales={distribucion?.filas}
          asientosChoferIniciales={distribucion?.asientosChofer}
          placaLibre={form.placa.trim() || "Nuevo vehículo"}
          onGuardarDraft={manejarGuardarDraft}
          onCerrado={() => setDisenadorAbierto(false)}
        />
      )}
    </div>
  );
}
