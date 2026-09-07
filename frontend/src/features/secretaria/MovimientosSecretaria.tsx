import { useEffect, useMemo, useState } from "react";
import {
  obtenerMovimientosSecretaria,
  obtenerMovimientoSecretaria,
  type MovimientoSecretaria,
} from "../../api/secretaria.api";
import {
  ScrollText,
  Search,
  Eye,
  X,
  ShieldAlert,
  User,
  FileText,
  Fingerprint,
  ListChecks,
  ChevronLeft,
  ChevronRight,
  Lock,
  RefreshCw,
  Download,
  Database,
} from "lucide-react";

const tamanosPagina = [8, 15, 25, 50];

const ETIQUETAS_MODULO: Record<string, string> = {
  boleteria: "Boletería",
  reembolsos: "Reembolsos",
  retiros: "Retiros de fila",
  filas: "Filas y paradas",
  vehiculos: "Vehículos",
  choferes: "Choferes",
  usuarios: "Usuarios",
  configuracion: "Configuración",
};

const MODULOS_FILTRO = [
  "boleteria",
  "reembolsos",
  "retiros",
  "filas",
  "vehiculos",
  "choferes",
  "usuarios",
  "configuracion",
];

const ETIQUETAS_ACCION: Record<string, string> = {
  vender_boleteria: "Registrar venta de boletería",
  cancelar_venta: "Cancelar venta",
  confirmar_reembolso: "Confirmar reembolso",
  actualizar_configuracion: "Actualizar configuración del sindicato",
  aprobar_retiro: "Aprobar retiro de la fila",
  rechazar_retiro: "Rechazar retiro de la fila",
  reordenar_fila: "Reordenar fila",
  mover_vehiculo: "Mover vehículo de parada",
  trasladar_vehiculo: "Trasladar vehículo",
  configurar_parada: "Configurar parada",
  registrar_chofer: "Registrar chofer",
  modificar_chofer: "Modificar chofer",
  activar_chofer: "Activar chofer",
  inactivar_chofer: "Inactivar chofer",
  asignar_chofer: "Asignar vehículo a chofer",
  registrar_vehiculo: "Registrar vehículo",
  modificar_vehiculo: "Modificar vehículo",
  eliminar_vehiculo: "Eliminar registro de vehículo",
  configurar_asientos: "Configurar asientos del vehículo",
  crear_tipo_vehiculo: "Crear tipo de vehículo",
  eliminar_tipo_vehiculo: "Eliminar tipo de vehículo",
  registrar_usuario: "Registrar usuario",
  modificar_usuario: "Modificar usuario",
  asignar_rol: "Asignar rol a usuario",
  restablecer_clave: "Restablecer contraseña",
};

function etiquetaAccion(accion: string): string {
  if (ETIQUETAS_ACCION[accion]) return ETIQUETAS_ACCION[accion];
  return accion
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function etiquetaModulo(modulo: string): string {
  return ETIQUETAS_MODULO[modulo] || modulo;
}

const COLOR_MODULO: Record<string, string> = {
  boleteria: "bg-sky-400/10 text-sky-400",
  reembolsos: "bg-red-400/10 text-red-400",
  retiros: "bg-amber-400/10 text-amber-400",
  filas: "bg-indigo-400/10 text-indigo-400",
  vehiculos: "bg-emerald-400/10 text-emerald-400",
  choferes: "bg-violet-400/10 text-violet-400",
  usuarios: "bg-cyan-400/10 text-cyan-400",
  configuracion: "bg-purple-400/10 text-purple-400",
};

function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Bitácora de auditoría de la Secretaría: SOLO LECTURA.
// Cada movimiento se genera automáticamente en el backend con el usuario
// del JWT; no es posible crear, modificar ni eliminar registros.
export default function MovimientosSecretaria() {
  const [movimientos, setMovimientos] = useState<MovimientoSecretaria[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [usuario, setUsuario] = useState("");
  const [modulo, setModulo] = useState("");
  const [accion, setAccion] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [seleccionado, setSeleccionado] = useState<MovimientoSecretaria | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerMovimientosSecretaria({
        busqueda: busqueda || undefined,
        usuario: usuario || undefined,
        modulo: modulo || undefined,
        accion: accion || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
        page,
        pageSize,
      });
      setMovimientos(data.movimientos);
      setTotal(data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, [busqueda, usuario, modulo, accion, desde, hasta, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [busqueda, usuario, modulo, accion, desde, hasta, pageSize]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarDetalle();
    }
    if (seleccionado) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [seleccionado]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paginaActual = Math.min(page, totalPages);
  const desdeFila = total === 0 ? 0 : (paginaActual - 1) * pageSize + 1;
  const hastaFila = Math.min(total, paginaActual * pageSize);

  const paginasVisibles = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 7),
    [totalPages]
  );

  function irAPagina(p: number) {
    if (p >= 1 && p <= totalPages) setPage(p);
  }

  async function abrirDetalle(m: MovimientoSecretaria) {
    setSeleccionado(m);
    setCargandoDetalle(true);
    setErrorDetalle(null);
    try {
      const completo = await obtenerMovimientoSecretaria(m.id);
      setSeleccionado(completo);
    } catch (e: any) {
      console.error(e);
      setErrorDetalle(
        e?.response?.data?.message || "No se pudo cargar el movimiento de auditoría."
      );
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cerrarDetalle() {
    setSeleccionado(null);
    setCargandoDetalle(false);
    setErrorDetalle(null);
  }

  function exportarCSV() {
    const encabezados = [
      "Fecha",
      "Usuario",
      "Rol",
      "Modulo",
      "Accion",
      "Detalle",
      "Registro",
      "IP",
    ];
    const escapar = (v: unknown) =>
      `"${(v === null || v === undefined ? "" : String(v)).replace(/"/g, '""')}"`;
    const filas = movimientos.map((m) =>
      [
        formatFechaHora(m.fechaHora),
        m.usuarioNombre,
        m.rol,
        etiquetaModulo(m.modulo),
        etiquetaAccion(m.accion),
        m.detalle || "",
        m.registroId || "",
        m.ip || "",
      ]
        .map(escapar)
        .join(",")
    );
    const csv = "\uFEFF" + [encabezados.join(","), ...filas].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movimientos-secretaria_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const selectCls =
    "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500";
  const inputCls =
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-sky-400" /> Movimientos de la Secretaría
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Bitácora de auditoría inmutable de las acciones realizadas por el rol Secretaría
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportarCSV}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer border border-gray-700"
          >
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button
            onClick={cargar}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer border border-gray-700"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {/* Aviso de inmutabilidad */}
      <div className="flex items-start gap-3 bg-amber-400/5 border border-amber-400/20 rounded-xl p-3.5">
        <Lock className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-200/90 leading-relaxed">
          Los movimientos de auditoría son <span className="font-semibold text-amber-200">permanentes y
          no pueden modificarse ni eliminarse</span>. Se registran automáticamente en el backend con
          el usuario autenticado (JWT) y la dirección IP de la sesión.
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar: usuario, acción, detalle..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={`${inputCls} pl-8`}
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Usuario</label>
            <input
              type="text"
              placeholder="Nombre de usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Módulo</label>
            <select
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
              className={`${selectCls} w-full`}
            >
              <option value="">Todos</option>
              {MODULOS_FILTRO.map((m) => (
                <option key={m} value={m}>{etiquetaModulo(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Acción</label>
            <input
              type="text"
              placeholder="Ej: confirmar_reembolso"
              value={accion}
              onChange={(e) => setAccion(e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {cargando ? (
          <div className="py-14 flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-sky-400" />
            <p className="text-sm text-gray-500">Cargando movimientos...</p>
          </div>
        ) : movimientos.length === 0 ? (
          <div className="py-16 text-center">
            <Database className="w-10 h-10 text-gray-600 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No hay movimientos que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Fecha y hora</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Usuario</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Módulo</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Acción</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Detalle</th>
                  <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Registro</th>
                  <th className="text-right text-[11px] font-medium text-gray-400 uppercase px-4 py-3" aria-label="Ver detalle"></th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => abrirDetalle(m)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        abrirDetalle(m);
                      }
                    }}
                    className="group border-b border-gray-800/50 hover:bg-sky-500/10 hover:border-sky-500/30 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{formatFechaHora(m.fechaHora)}</td>
                    <td className="px-4 py-3 text-sm">
                      <p className="text-white font-medium">{m.usuarioNombre}</p>
                      <p className="text-[10px] text-gray-500 uppercase">{m.rol}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${COLOR_MODULO[m.modulo] || "bg-gray-800 text-gray-400"}`}>
                        {etiquetaModulo(m.modulo)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">{etiquetaAccion(m.accion)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[280px] truncate">{m.detalle || "—"}</td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-400 truncate max-w-[160px]">{m.registroId || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Eye className="w-4 h-4 text-sky-400/0 group-hover:text-sky-400 transition-colors inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 border-t border-gray-800">
          <span className="text-xs text-gray-500">
            Mostrando <span className="text-white font-medium">{desdeFila}</span> a{" "}
            <span className="text-white font-medium">{hastaFila}</span> de{" "}
            <span className="text-white font-medium">{total}</span> movimientos
          </span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              aria-label="Movimientos por página"
            >
              {tamanosPagina.map((t) => (
                <option key={t} value={t}>{t} / página</option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button
                onClick={() => irAPagina(paginaActual - 1)}
                disabled={paginaActual <= 1}
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Página anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {paginasVisibles.map((p) => (
                <button
                  key={p}
                  onClick={() => irAPagina(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    p === paginaActual
                      ? "bg-sky-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
              {totalPages > 7 && <span className="text-xs text-gray-500 px-1">…</span>}
              <button
                onClick={() => irAPagina(paginaActual + 1)}
                disabled={paginaActual >= totalPages}
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                aria-label="Página siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {seleccionado && (
        <ModalMovimiento
          movimiento={seleccionado}
          cargando={cargandoDetalle}
          error={errorDetalle}
          onCerrar={cerrarDetalle}
          onReintentar={() => abrirDetalle(seleccionado)}
        />
      )}
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  if (valor === null || valor === undefined || valor === "") return null;
  return (
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 py-1">
      <span className="text-xs text-gray-500">{etiqueta}</span>
      <span className="text-sm text-white text-right break-all">{valor}</span>
    </div>
  );
}

function BloqueJson({ titulo, datos }: { titulo: string; datos: Record<string, unknown> | null }) {
  if (!datos) return null;
  return (
    <div>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">{titulo}</p>
      <pre className="bg-gray-900/80 border border-gray-800 rounded-lg p-3 text-[11px] text-green-300 font-mono overflow-x-auto whitespace-pre-wrap break-words">
        {JSON.stringify(datos, null, 2)}
      </pre>
    </div>
  );
}

function ModalMovimiento({
  movimiento,
  cargando,
  error,
  onCerrar,
  onReintentar,
}: {
  movimiento: MovimientoSecretaria;
  cargando: boolean;
  error: string | null;
  onCerrar: () => void;
  onReintentar: () => void;
}) {
  const m = movimiento;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-6"
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Detalle del movimiento de auditoría"
        className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        {/* Encabezado + aviso de inmutabilidad */}
        <div className="px-5 py-4 border-b border-gray-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Movimiento de auditoría</h2>
            </div>
            <button
              onClick={onCerrar}
              aria-label="Cerrar"
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 flex items-start gap-2 bg-amber-400/5 border border-amber-400/20 rounded-lg p-2.5">
            <Lock className="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-200/90">
              Registro de auditoría — <span className="font-semibold text-amber-200">no modificable</span>.
              La bitácora es permanente y no puede eliminarse ni alterarse.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {cargando && (
            <div className="py-12 flex flex-col items-center gap-3 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
              <p className="text-sm">Cargando detalle...</p>
            </div>
          )}

          {!cargando && error && (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-red-400 font-medium">{error}</p>
              <button
                onClick={onReintentar}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Reintentar
              </button>
            </div>
          )}

          {!cargando && !error && (
            <>
              {/* Acción registrada */}
              <div className="flex items-center gap-3 bg-sky-500/5 border border-sky-500/20 rounded-xl p-3">
                <div className="w-10 h-10 rounded-lg bg-sky-400/10 flex items-center justify-center">
                  <ListChecks className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{etiquetaAccion(m.accion)}</p>
                  <span className={`inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full font-medium ${COLOR_MODULO[m.modulo] || "bg-gray-800 text-gray-400"}`}>
                    {etiquetaModulo(m.modulo)}
                  </span>
                </div>
              </div>

              {/* Hora y origen */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-1">
                <Fila etiqueta="Fecha y hora" valor={formatFechaHora(m.fechaHora)} />
                <Fila etiqueta="Dirección IP" valor={m.ip || "No registrada"} />
                <Fila
                  etiqueta="UUID del movimiento"
                  valor={<span className="font-mono text-xs">{m.id}</span>}
                />
                <Fila
                  etiqueta="Registrado en base de datos"
                  valor={m.createdAt ? formatFechaHora(m.createdAt) : "—"}
                />
              </div>

              {/* Usuario autenticado que ejecutó la acción */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Usuario que ejecutó la acción
                  </h3>
                </div>
                <Fila etiqueta="Nombre de usuario" valor={m.usuarioNombre} />
                <Fila etiqueta="Rol" valor={m.rol} />
                <Fila
                  etiqueta="ID del usuario (JWT)"
                  valor={<span className="font-mono text-xs">{m.usuarioId}</span>}
                />
              </div>

              {/* Detalle y registro relacionado */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Detalle</h3>
                </div>
                <p className="text-sm text-gray-200 leading-relaxed">{m.detalle || "Sin detalle adicional."}</p>
                <Fila
                  etiqueta="Registro relacionado"
                  valor={<span className="font-mono text-xs">{m.registroId || "—"}</span>}
                />
              </div>

              {/* Cambios antes / después */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-gray-500" />
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Cambios registrados
                  </h3>
                </div>
                <BloqueJson titulo="Datos anteriores" datos={m.datosAnteriores} />
                <BloqueJson titulo="Datos nuevos" datos={m.datosNuevos} />
                {!m.datosAnteriores && !m.datosNuevos && (
                  <p className="text-xs text-gray-500">Esta acción no registró cambios de datos.</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-800 flex justify-end">
          <button
            onClick={onCerrar}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors cursor-pointer border border-gray-700"
          >
            <X className="w-4 h-4" /> Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}