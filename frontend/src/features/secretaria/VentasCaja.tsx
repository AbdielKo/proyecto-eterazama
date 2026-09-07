import { useEffect, useMemo, useState } from "react";
import {
  obtenerVentasSecretaria,
  obtenerNomina,
  obtenerDetalleVenta,
  type NominaItem,
  type DetalleVenta,
} from "../../api/secretaria.api";
import type { Pasaje } from "../../types/pasaje";
import { toMoneyNumber, formatBs } from "../../utils/formatMoney";
import {
  DollarSign,
  Ticket,
  Package,
  TrendingUp,
  ShoppingCart,
  Search,
  Download,
  Eye,
  X,
  User,
  Car,
  Route,
  Receipt,
  Info,
  ChevronDown,
  RefreshCw,
  Phone,
  Truck,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const periodos = [
  { value: "todos", label: "Todo" },
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
];

const tramos = [
  { value: "todos", label: "Todos" },
  { value: "cochabamba", label: "Cochabamba" },
  { value: "eterazama", label: "Eterazama" },
];

const metodosPago = [
  { value: "todos", label: "Todos" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "QR", label: "QR / Transferencia" },
  { value: "TARJETA", label: "Tarjeta" },
];

const tamanosPagina = [8, 15, 25, 50];

function money(n: number | null | undefined): string {
  return (
    "Bs " +
    Number(n || 0).toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

const tramoLabel = (tramo?: string) =>
  tramo === "eterazama"
    ? "Eterazama"
    : tramo === "cochabamba"
      ? "Cochabamba"
      : tramo || "—";

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-BO");
}

function formatHora(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });
}

function EstadoBadge({ venta }: { venta: Pasaje }) {
  const reembolsado = venta.estadoReembolso === "REEMBOLSADO";
  if (reembolsado || venta.estadoBoleto === "REEMBOLSADO") {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-400/10 text-red-400">
        REEMBOLSADO
      </span>
    );
  }
  if (venta.estadoBoleto === "UTILIZADO") {
    return (
      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-sky-400/10 text-sky-400">
        UTILIZADO
      </span>
    );
  }
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-400/10 text-emerald-400">
      {venta.estadoBoleto || "ACTIVO"}
    </span>
  );
}

// "Ventas y Caja": módulo único que unifica Caja Central + Historial de Ventas.
// Muestra el resumen económico global (que se recalcula con los filtros
// aplicados), el historial completo con múltiples filtros, paginación,
// exportación CSV y el detalle completo de cada venta.
export default function VentasCaja() {
  const [ventas, setVentas] = useState<Pasaje[]>([]);
  const [choferes, setChoferes] = useState<NominaItem[]>([]);
  const [cargando, setCargando] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [periodo, setPeriodo] = useState("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [choferId, setChoferId] = useState("");
  const [placa, setPlaca] = useState("");
  const [tramo, setTramo] = useState("todos");
  const [metodoPago, setMetodoPago] = useState("todos");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [ventaSeleccionada, setVentaSeleccionada] = useState<Pasaje | null>(null);
  const [detalle, setDetalle] = useState<DetalleVenta | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const data = await obtenerVentasSecretaria({ periodo: "todos" });
      setVentas(data.ventas as Pasaje[]);
    } catch (e) {
      console.error(e);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    obtenerNomina().then(setChoferes).catch(console.error);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [busqueda, periodo, fechaDesde, fechaHasta, choferId, placa, tramo, metodoPago, pageSize]);

  // Cerrar modal con tecla ESC.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarModal();
    }
    if (ventaSeleccionada) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [ventaSeleccionada]);

  const mapPlacaChofer = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of choferes) {
      if (c.placa) m.set(c.placa, c.nombreCompleto || c.nombreUsuario);
    }
    return m;
  }, [choferes]);

  const placas = useMemo(
    () =>
      Array.from(
        new Set(choferes.map((c) => c.placa).filter((p): p is string => Boolean(p)))
      ).sort(),
    [choferes]
  );

  // Fecha límite según el periodo seleccionado (todo/día/semana/mes).
  function desdePeriodo(): Date | null {
    if (periodo === "todos") return null;
    const ahora = new Date();
    if (periodo === "dia") ahora.setHours(0, 0, 0, 0);
    if (periodo === "semana") ahora.setDate(ahora.getDate() - 7);
    if (periodo === "mes") ahora.setMonth(ahora.getMonth() - 1);
    return ahora;
  }

  const filtradas = useMemo(() => {
    const limite = desdePeriodo();
    return ventas.filter((v) => {
      const fecha = v.fechaCreacion ? new Date(v.fechaCreacion) : null;

      if (limite && fecha && fecha < limite) return false;
      if (fechaDesde && fecha) {
        const d = new Date(fechaDesde + "T00:00:00");
        if (!isNaN(d.getTime()) && fecha < d) return false;
      }
      if (fechaHasta && fecha) {
        const d = new Date(fechaHasta + "T23:59:59");
        if (!isNaN(d.getTime()) && fecha > d) return false;
      }
      if (tramo !== "todos" && v.tramo !== tramo) return false;
      if (metodoPago !== "todos" && (v.metodoPago || "EFECTIVO") !== metodoPago) return false;

      const choferDe = v.placaVehiculo ? mapPlacaChofer.get(v.placaVehiculo) : undefined;
      if (choferId) {
        const c = choferes.find((x) => x.id === choferId);
        const placasChofer = c?.placa;
        if (placasChofer && v.placaVehiculo !== placasChofer) return false;
        if (!placasChofer && choferDe !== c?.nombreCompleto) return false;
      }
      if (placa && v.placaVehiculo !== placa) return false;

      const busquedaTexto = [
        v.pasajeroNombre,
        v.placaVehiculo,
        v.tramo,
        v.codigoBarras || v.codigo,
        v.id,
        choferDe,
        ...(v.pasajeros || []).map((p) => p.nombre),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return busquedaTexto.includes(busqueda.toLowerCase());
    });
  }, [ventas, busqueda, periodo, fechaDesde, fechaHasta, choferId, choferes, placa, tramo, metodoPago, mapPlacaChofer]);

  // Totales sobre el conjunto filtrado (iguales a los globales sin filtros).
  const totalBoletos = filtradas.reduce((t, v) => t + (v.asientos?.length || 1), 0);
  const totalVentas = filtradas.length;
  const totalPasajes = filtradas.reduce((t, v) => t + toMoneyNumber(v.montoAsientos), 0);
  const totalEncomiendas = filtradas.reduce((t, v) => t + toMoneyNumber(v.montoEncomienda), 0);
  const totalNetoVentas = filtradas.reduce((t, v) => {
    if (v.estadoReembolso === "REEMBOLSADO" || v.estadoBoleto === "REEMBOLSADO") return t;
    return t + toMoneyNumber(v.montoTotal);
  }, 0);

  const items = [
    { label: "Boletos vendidos", value: String(totalBoletos), icon: Ticket, color: "text-sky-400 bg-sky-400/10" },
    { label: "Ventas", value: String(totalVentas), icon: ShoppingCart, color: "text-cyan-400 bg-cyan-400/10" },
    { label: "Pasajes", value: formatBs(totalPasajes), icon: DollarSign, color: "text-emerald-400 bg-emerald-400/10" },
    { label: "Encomiendas", value: formatBs(totalEncomiendas), icon: Package, color: "text-amber-400 bg-amber-400/10" },
    { label: "TOTAL CAJA", value: formatBs(totalNetoVentas), icon: TrendingUp, color: "text-green-400 bg-green-400/10" },
  ];

  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize));
  const paginaActual = Math.min(page, totalPages);
  const desde = (paginaActual - 1) * pageSize;
  const visibles = filtradas.slice(desde, desde + pageSize);

  const paginasVisibles = Array.from({ length: totalPages }, (_, i) => i + 1);

  function irAPagina(p: number) {
    if (p >= 1 && p <= totalPages) setPage(p);
  }

  // Exporta EXACTAMENTE lo que está filtrado (todas las páginas, no solo la actual).
  function exportarCSV() {
    const encabezados = [
      "Fecha",
      "Codigo",
      "Comprador",
      "Pasajeros",
      "Placa",
      "Chofer",
      "Tramo",
      "Asientos",
      "Pasajes",
      "Encomienda",
      "Total",
      "Pago",
      "Estado",
    ];
    const escapar = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const filas = filtradas.map((v) =>
      [
        v.fechaCreacion ? new Date(v.fechaCreacion).toLocaleString("es-BO") : "",
        v.codigoBarras || v.codigo || "",
        v.pasajeroNombre || "",
        (v.pasajeros || []).map((p) => `${p.nombre} (A${p.asiento})`).join("; "),
        v.placaVehiculo || "",
        (v.placaVehiculo ? mapPlacaChofer.get(v.placaVehiculo) : "") || "",
        v.tramo || "",
        (v.asientos || []).join("; "),
        toMoneyNumber(v.montoAsientos).toFixed(2),
        toMoneyNumber(v.montoEncomienda).toFixed(2),
        toMoneyNumber(v.montoTotal).toFixed(2),
        v.metodoPago || "EFECTIVO",
        v.estadoBoleto || v.estadoReembolso || "ACTIVO",
      ]
        .map(escapar)
        .join(",")
    );
    const csv = "\uFEFF" + [encabezados.join(","), ...filas].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventas-y-caja_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function abrirDetalle(v: Pasaje) {
    setVentaSeleccionada(v);
    setDetalle(null);
    setErrorDetalle(null);
    setCargandoDetalle(true);
    try {
      const data = await obtenerDetalleVenta(v.id);
      setDetalle(data);
    } catch (e: any) {
      console.error(e);
      setErrorDetalle(
        e?.response?.data?.message || "No se pudo cargar el detalle de esta venta."
      );
    } finally {
      setCargandoDetalle(false);
    }
  }

  function cerrarModal() {
    setVentaSeleccionada(null);
    setDetalle(null);
    setErrorDetalle(null);
    setCargandoDetalle(false);
  }

  const selectCls =
    "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500";
  const inputCls =
    "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Ventas y Caja</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {filtradas.length} ventas | Total: <span className="text-green-400 font-semibold">{formatBs(totalNetoVentas)}</span>
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

      {cargando ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-12 text-center">
          <p className="text-gray-500 text-sm">Cargando ventas y caja...</p>
        </div>
      ) : (
        <>
          {/* Resumen económico (recalculado con los filtros aplicados) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.color} mb-2`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className="text-[11px] text-gray-500">{item.label}</p>
                  <p className="text-lg font-bold text-white mt-0.5">{item.value}</p>
                </div>
              );
            })}
          </div>

          {/* Filtros */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar: pasajero, placa, código, tramo..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className={`${inputCls} pl-8`}
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Periodo</label>
                <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={`${selectCls} w-full`}>
                  {periodos.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Desde</label>
                <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className={`${inputCls}`} />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Hasta</label>
                <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className={`${inputCls}`} />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Chofer</label>
                <select value={choferId} onChange={(e) => setChoferId(e.target.value)} className={`${selectCls} w-full`}>
                  <option value="">Todos</option>
                  {choferes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombreCompleto}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Vehiculo</label>
                <select value={placa} onChange={(e) => setPlaca(e.target.value)} className={`${selectCls} w-full`}>
                  <option value="">Todos</option>
                  {placas.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Tramo</label>
                <select value={tramo} onChange={(e) => setTramo(e.target.value)} className={`${selectCls} w-full`}>
                  {tramos.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Pago</label>
                <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className={`${selectCls} w-full`}>
                  {metodosPago.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setBusqueda("");
                    setPeriodo("todos");
                    setFechaDesde("");
                    setFechaHasta("");
                    setChoferId("");
                    setPlaca("");
                    setTramo("todos");
                    setMetodoPago("todos");
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer border border-gray-700"
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          {/* Tabla de movimientos */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {filtradas.length === 0 ? (
              <div className="py-16 text-center">
                <Ticket className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No hay ventas que coincidan con los filtros</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Fecha</th>
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Código</th>
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Comprador</th>
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Pasajeros</th>
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Placa</th>
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Chofer</th>
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Tramo</th>
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Asientos</th>
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Pasajes</th>
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Encomienda</th>
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Total</th>
                      <th className="text-left text-[11px] font-medium text-gray-400 uppercase px-4 py-3">Pago</th>
                      <th className="text-right text-[11px] font-medium text-gray-400 uppercase px-4 py-3" aria-label="Ver detalle"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((v) => (
                      <tr
                        key={v.id}
                        onClick={() => abrirDetalle(v)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            abrirDetalle(v);
                          }
                        }}
                        className="group border-b border-gray-800/50 hover:bg-sky-500/10 hover:border-sky-500/30 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {formatFecha(v.fechaCreacion)}
                          {formatHora(v.fechaCreacion) && (
                            <span className="text-gray-600 ml-1">{formatHora(v.fechaCreacion)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-sky-400">{v.codigoBarras || v.codigo || "—"}</td>
                        <td className="px-4 py-3 text-sm">
                          <p className="text-white font-medium">{v.pasajeroNombre || "—"}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {(v.pasajeros || []).map((p) => `${p.nombre} (A${p.asiento})`).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-sky-400">{v.placaVehiculo || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {v.placaVehiculo ? mapPlacaChofer.get(v.placaVehiculo) || "—" : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">{tramoLabel(v.tramo)}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{v.asientos?.join(", ") || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{formatBs(v.montoAsientos)}</td>
                        <td className="px-4 py-3 text-sm text-gray-300">{formatBs(v.montoEncomienda)}</td>
                        <td className="px-4 py-3 text-sm text-green-400 font-semibold">
                          {formatBs(v.montoTotal)}
                          {v.estadoReembolso === "REEMBOLSADO" && (
                            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-400/10 text-red-400 align-middle">
                              REEMBOLSADO
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              (v.metodoPago || "EFECTIVO") === "EFECTIVO"
                                ? "bg-emerald-400/10 text-emerald-400"
                                : "bg-gray-800 text-gray-500"
                            }`}
                          >
                            {v.metodoPago || "EFECTIVO"}
                          </span>
                        </td>
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
                Mostrando <span className="text-white font-medium">{filtradas.length === 0 ? 0 : desde + 1}</span> a{" "}
                <span className="text-white font-medium">
                  {Math.min(desde + pageSize, filtradas.length)}
                </span>{" "}
                de <span className="text-white font-medium">{filtradas.length}</span> ventas
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  aria-label="Ventas por página"
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
                  {paginasVisibles.slice(0, 7).map((p) => (
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
                  {totalPages > 7 && (
                    <span className="text-xs text-gray-500 px-1">…</span>
                  )}
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
        </>
      )}

      {ventaSeleccionada && (
        <ModalDetalleVenta
          venta={ventaSeleccionada}
          detalle={detalle}
          cargando={cargandoDetalle}
          error={errorDetalle}
          onCerrar={cerrarModal}
          onReintentar={() => abrirDetalle(ventaSeleccionada)}
        />
      )}
    </div>
  );
}

function Seccion({
  icono,
  titulo,
  children,
}: {
  icono: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {icono}
        <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{titulo}</h3>
      </div>
      {children}
    </div>
  );
}

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  if (valor === null || valor === undefined || valor === "" || valor === "—") return null;
  return (
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 py-1">
      <span className="text-xs text-gray-500">{etiqueta}</span>
      <span className="text-sm text-white text-right break-all">{valor}</span>
    </div>
  );
}

function ModalDetalleVenta({
  venta,
  detalle,
  cargando,
  error,
  onCerrar,
  onReintentar,
}: {
  venta: Pasaje;
  detalle: DetalleVenta | null;
  cargando: boolean;
  error: string | null;
  onCerrar: () => void;
  onReintentar: () => void;
}) {
  const veh = detalle?.vehiculo ?? null;
  const usuario = detalle?.pasajeroUsuario ?? null;
  const ventaDetalle = detalle?.venta ?? venta;

  const codigoBoleto = ventaDetalle.codigoBarras || ventaDetalle.codigo || null;

  const pasajerosLista = (ventaDetalle.pasajeros || [])
    .filter((p) => p && p.asiento != null && p.nombre)
    .slice()
    .sort((a, b) => (a.asiento || 0) - (b.asiento || 0));
  const mapeoPasajeroAsiento = pasajerosLista.length > 0;

  const asientos = Array.from(new Set(ventaDetalle.asientos || []))
    .filter((a): a is number => Number.isFinite(Number(a)))
    .sort((a, b) => Number(a) - Number(b));
  const tieneAsientos = asientos.length > 0;

  const nombreComprador = ventaDetalle.pasajeroNombre || null;

  const contacto = ventaDetalle.contactoRecibo
    ? ventaDetalle.contactoRecibo.trim().toLowerCase() !==
      (ventaDetalle.pasajeroNombre || "").trim().toLowerCase()
      ? ventaDetalle.contactoRecibo
      : null
    : null;

  const nombreUsuario = usuario
    ? ([usuario.nombre, usuario.apellidos].filter(Boolean).join(" ").trim() ||
        usuario.nombreUsuario)
    : null;

  const ruta =
    ventaDetalle.origen && ventaDetalle.destino
      ? `${ventaDetalle.origen} → ${ventaDetalle.destino}`
      : null;
  const hora = formatHora(ventaDetalle.fechaCreacion);
  const tieneEncomienda = Number(ventaDetalle.montoEncomienda || 0) > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-3 sm:p-6"
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de venta"
        className="bg-gray-950 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">Detalle de venta</h2>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {codigoBoleto ? (
                <span className="bg-sky-500/10 text-sky-300 border border-sky-500/30 rounded-lg px-3 py-1.5 font-mono text-sm font-semibold tracking-wide">
                  {codigoBoleto}
                </span>
              ) : (
                <span className="text-xs text-gray-500">Sin código de boleto registrado</span>
              )}
              <EstadoBadge venta={ventaDetalle} />
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">Código de boleto</p>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar detalle de venta"
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {cargando && (
            <div className="py-14 flex flex-col items-center gap-3 text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
              <p className="text-sm">Cargando detalle...</p>
            </div>
          )}

          {!cargando && error && (
            <div className="py-10 flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-red-400 font-medium">
                No se pudo cargar el detalle de esta venta.
              </p>
              {error && error !== "No se pudo cargar el detalle de esta venta." && (
                <p className="text-xs text-gray-500">{error}</p>
              )}
              <button
                onClick={onReintentar}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" /> Reintentar
              </button>
            </div>
          )}

          {!cargando && !error && detalle && (
            <>
              <Seccion icono={<User className="w-4 h-4 text-emerald-400" />} titulo="Comprador">
                {nombreComprador ? (
                  <p className="text-base font-semibold text-white">{nombreComprador}</p>
                ) : (
                  <p className="text-sm text-gray-500">Sin nombre registrado.</p>
                )}
                {contacto && <FilaDato etiqueta="Contacto del recibo" valor={contacto} />}
                <FilaDato etiqueta="CI" valor={ventaDetalle.ciRecibo} />
                {ventaDetalle.telefonoRecibo && (
                  <FilaDato
                    etiqueta="Teléfono"
                    valor={
                      <span className="flex items-center gap-1 justify-end">
                        <Phone className="w-3 h-3 text-gray-500" />
                        {ventaDetalle.telefonoRecibo}
                      </span>
                    }
                  />
                )}
                {usuario && (
                  <div className="mt-3 pt-3 border-t border-gray-800">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">
                      Cuenta que realizó la compra
                    </p>
                    <p className="text-sm font-medium text-white">{nombreUsuario}</p>
                    {usuario.gmail && <p className="text-xs text-gray-500">{usuario.gmail}</p>}
                    {usuario.telefono && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {usuario.telefono}
                      </p>
                    )}
                  </div>
                )}
              </Seccion>

              <Seccion icono={<Users className="w-4 h-4 text-emerald-400" />} titulo="Pasajeros">
                {tieneAsientos && (
                  <div className="mb-3">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1.5">
                      Asientos vendidos
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {asientos.map((a) => (
                        <span
                          key={a}
                          className="text-[10px] bg-gray-800 text-gray-300 px-2 py-1 rounded-lg"
                        >
                          Asiento {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {mapeoPasajeroAsiento ? (
                  <div className="overflow-x-auto rounded-lg border border-gray-800">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-800/50">
                          <th className="text-left text-[10px] font-medium text-gray-500 uppercase px-3 py-2">
                            Asiento
                          </th>
                          <th className="text-left text-[10px] font-medium text-gray-500 uppercase px-3 py-2">
                            Pasajero
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pasajerosLista.map((p, i) => (
                          <tr key={i} className="border-t border-gray-800">
                            <td className="px-3 py-2">
                              <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded">
                                {p.asiento}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-sm text-white">
                              {p.nombre}
                              {p.ci && <span className="text-xs text-gray-500 ml-2">CI: {p.ci}</span>}
                              {p.telefono && (
                                <span className="text-xs text-gray-500 ml-2">Tel: {p.telefono}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    {tieneAsientos
                      ? "No hay registro de pasajero por asiento en esta venta."
                      : "Sin asientos registrados."}
                  </p>
                )}
              </Seccion>

              <Seccion icono={<Car className="w-4 h-4 text-sky-400" />} titulo="Vehículo">
                <FilaDato
                  etiqueta="Placa"
                  valor={<span className="font-mono text-sky-400">{ventaDetalle.placaVehiculo}</span>}
                />
                {veh ? (
                  <>
                    <FilaDato
                      etiqueta="Chofer"
                      valor={
                        veh.choferNombre
                          ? `${veh.choferNombre}${veh.choferCi ? ` · CI ${veh.choferCi}` : ""}`
                          : null
                      }
                    />
                    {(veh.tipoVehiculo || veh.color || veh.capacidadTotal) && (
                      <div className="mt-2 pt-2 border-t border-gray-800 text-xs text-gray-500">
                        {[veh.tipoVehiculo, veh.color, veh.capacidadTotal ? `${veh.capacidadTotal} asientos` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-500">
                    No se encontró el vehículo registrado para esta venta.
                  </p>
                )}
              </Seccion>

              <Seccion icono={<Route className="w-4 h-4 text-sky-400" />} titulo="Ruta y fecha">
                <FilaDato etiqueta="Ruta" valor={ruta || tramoLabel(ventaDetalle.tramo)} />
                {!ruta && ventaDetalle.tramo && (
                  <FilaDato etiqueta="Tramo" valor={tramoLabel(ventaDetalle.tramo)} />
                )}
                <FilaDato etiqueta="Fecha" valor={formatFecha(ventaDetalle.fechaCreacion)} />
                <FilaDato etiqueta="Hora" valor={hora} />
              </Seccion>

              <Seccion icono={<Receipt className="w-4 h-4 text-amber-400" />} titulo="Resumen económico">
                {detalle.precioPorAsiento !== null && (
                  <FilaDato etiqueta="Precio por asiento" valor={money(detalle.precioPorAsiento)} />
                )}
                <FilaDato
                  etiqueta="Pasajes"
                  valor={<span className="text-amber-300">{money(ventaDetalle.montoAsientos)}</span>}
                />
                <FilaDato
                  etiqueta="Encomienda"
                  valor={<span className="text-amber-300">{money(ventaDetalle.montoEncomienda)}</span>}
                />
                <div className="mt-2 pt-2 border-t border-gray-800 flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</span>
                  <span className="text-lg font-bold text-amber-300">{money(ventaDetalle.montoTotal)}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-800 flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pago</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-400/10 text-emerald-400">
                    {ventaDetalle.metodoPago || "EFECTIVO"}
                  </span>
                </div>
              </Seccion>

              <Seccion icono={<Package className="w-4 h-4 text-orange-400" />} titulo="Encomienda">
                {tieneEncomienda ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-orange-400" />
                      <span className="text-sm text-white font-medium">Con encomienda</span>
                    </div>
                    <FilaDato
                      etiqueta="Monto"
                      valor={<span className="text-amber-300">{money(ventaDetalle.montoEncomienda)}</span>}
                    />
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Sin encomienda</p>
                )}
              </Seccion>

              <details className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none hover:bg-gray-800/50 transition-colors">
                  <Info className="w-4 h-4 text-gray-500 shrink-0" />
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    Información técnica
                  </span>
                  <ChevronDown className="w-4 h-4 ml-auto text-gray-500" />
                </summary>
                <div className="px-4 pb-4 pt-1 border-t border-gray-800">
                  <FilaDato etiqueta="UUID del pasaje / venta" valor={ventaDetalle.id} />
                  <FilaDato etiqueta="ID del boleto" valor={codigoBoleto} />
                  <FilaDato
                    etiqueta="Fecha de creación"
                    valor={
                      ventaDetalle.fechaCreacion
                        ? new Date(ventaDetalle.fechaCreacion).toLocaleString("es-BO")
                        : "—"
                    }
                  />
                  <FilaDato etiqueta="Escaneado por" valor={ventaDetalle.escaneadoPor} />
                  <FilaDato etiqueta="Vehículo relacionado" valor={ventaDetalle.placaVehiculo} />
                  {usuario && <FilaDato etiqueta="ID del comprador (usuario)" valor={usuario.id} />}
                  {ventaDetalle.estadoReembolso && (
                    <>
                      <FilaDato etiqueta="Estado de reembolso" valor={ventaDetalle.estadoReembolso} />
                      <FilaDato etiqueta="Motivo de cancelación" valor={ventaDetalle.motivoCancelacion} />
                      <FilaDato
                        etiqueta="Monto reembolsado"
                        valor={ventaDetalle.montoReembolsado != null ? money(ventaDetalle.montoReembolsado) : null}
                      />
                      <FilaDato
                        etiqueta="Fecha de reembolso"
                        valor={
                          ventaDetalle.fechaReembolso
                            ? new Date(ventaDetalle.fechaReembolso).toLocaleString("es-BO")
                            : "—"
                        }
                      />
                      <FilaDato etiqueta="Procesado por" valor={ventaDetalle.secretariaReembolso} />
                    </>
                  )}
                </div>
              </details>
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