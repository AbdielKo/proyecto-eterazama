import { useCallback, useEffect, useMemo, useState } from "react";
import {
  obtenerBoleteriaParadas,
  obtenerVehiculoBoleteria,
  venderBoleteria,
} from "../../api/boleteria.api";
import { confirmarReembolsoSecretaria } from "../../api/secretaria.api";
import type {
  ParadasBoleteria,
  Pasaje,
  VehiculoBoleteria,
} from "../../types/pasaje";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import ComprobantePreview from "./ComprobantePreview";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Armchair,
  Car,
  CheckCircle,
  ClipboardList,
  DollarSign,
  Loader2,
  MapPin,
  Package,
  Printer,
  Ticket,
  User,
  Users,
  X,
  Undo2,
  CheckCircle2,
  Ban,
} from "lucide-react";

const NOMBRES: Record<string, string> = {
  cochabamba: "Cochabamba",
  eterazama: "Eterazama",
};

type Paso = "paradas" | "asientos" | "pasajeros" | "resumen" | "confirmacion";

const PASOS: { id: Paso; label: string }[] = [
  { id: "paradas", label: "Parada" },
  { id: "asientos", label: "Asientos" },
  { id: "pasajeros", label: "Pasajeros" },
  { id: "resumen", label: "Resumen" },
  { id: "confirmacion", label: "Recibo" },
];

interface EstadoBadgeProps {
  estado: string;
}

function EstadoBadge({ estado }: EstadoBadgeProps) {
  const colores: Record<string, string> = {
    activo: "bg-emerald-400/10 text-emerald-400",
    en_ruta: "bg-sky-400/10 text-sky-400",
    fin_de_ruta: "bg-purple-400/10 text-purple-400",
    mantenimiento: "bg-amber-400/10 text-amber-400",
    inactivo: "bg-red-400/10 text-red-400",
    listo: "bg-gray-400/10 text-gray-400",
  };
  const etiquetas: Record<string, string> = {
    activo: "ACTIVO",
    en_ruta: "EN RUTA",
    fin_de_ruta: "FIN DE RUTA",
    mantenimiento: "MANTENIMIENTO",
    inactivo: "INACTIVO",
    listo: "LISTO",
  };
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
        colores[estado] || "bg-gray-400/10 text-gray-400"
      }`}
    >
      {etiquetas[estado] || estado}
    </span>
  );
}

function generarFilas(capacidadTotal: number): number[][] {
  const filas: number[][] = [];
  for (let i = 1; i <= capacidadTotal; i += 3) {
    filas.push([i, i + 1, i + 2].filter((n) => n <= capacidadTotal));
  }
  return filas;
}

function extraerError(e: unknown): string {
  const error = e as {
    response?: {
      data?: {
        message?: string | string[];
      };
    };
  };
  const mensaje = error?.response?.data?.message;
  if (Array.isArray(mensaje)) return mensaje[0] || "Error al registrar la venta";
  return mensaje || "Error al registrar la venta";
}

export default function Boleteria() {
  const [paradas, setParadas] = useState<ParadasBoleteria | null>(null);
  const [cargando, setCargando] = useState(true);
  const [paso, setPaso] = useState<Paso>("paradas");
  const [tramo, setTramo] = useState<"cochabamba" | "eterazama">("cochabamba");
  const [vehiculo, setVehiculo] = useState<VehiculoBoleteria | null>(null);
  const [asientosSel, setAsientosSel] = useState<number[]>([]);
  const [pasajeros, setPasajeros] = useState<Record<number, string>>({});
  const [recibo, setRecibo] = useState({ nombre: "", ci: "", telefono: "" });
  const [montoEncomienda, setMontoEncomienda] = useState("");
  const [venta, setVenta] = useState<Pasaje | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [cargandoVenta, setCargandoVenta] = useState(false);
  const [mostrarComprobante, setMostrarComprobante] = useState(false);
  const [detalleOcupado, setDetalleOcupado] = useState<{ pasaje: Pasaje; asiento: number } | null>(null);
  const [motivoReembolso, setMotivoReembolso] = useState("");
  const [cargandoReembolso, setCargandoReembolso] = useState(false);
  const [errorReembolso, setErrorReembolso] = useState("");

  const cargar = useCallback(async () => {
    try {
      const data = await obtenerBoleteriaParadas();
      setParadas(data);
    } catch (e) {
      setError("No se pudo cargar la boletería. Verifique la conexión.");
      console.error(e);
    } finally {
      setCargando(false);
    }
  }, []);

  useFlotaSocket(cargar);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Sincronizar el vehículo seleccionado con los cambios reales de la flota
  useEffect(() => {
    if (!vehiculo || !paradas) return;
    const lista = tramo === "cochabamba" ? paradas.cochabamba : paradas.eterazama;
    const actualizado = lista.find((v) => v.id === vehiculo.id);

    if (actualizado) {
      const ocupadosNuevos = actualizado.asientosOcupados || [];
      const perdidos = asientosSel.filter((a) => ocupadosNuevos.includes(a));
      setVehiculo(actualizado);
      if (perdidos.length > 0) {
        setAsientosSel((prev) => prev.filter((a) => !ocupadosNuevos.includes(a)));
        setPasajeros((prev) => {
          const nuevos = { ...prev };
          perdidos.forEach((a) => delete nuevos[a]);
          return nuevos;
        });
        setAviso(
          `El asiento ${perdidos.join(", ")} acaba de venderse en otra ventanilla. Selecciona otro asiento.`
        );
      }
    } else {
      setAviso("Este vehículo ya no está disponible en la parada. Selecciona otro.");
    }
  }, [paradas, tramo, vehiculo?.id]);

  const precios = paradas?.precios;
  const precioUnitario = precios?.[tramo] ?? 0;
  const subtotal = asientosSel.length * precioUnitario;
  const encomienda = Number(parseFloat(montoEncomienda) || 0);
  const total = subtotal + encomienda;

  const ocupados = vehiculo?.asientosOcupados || [];
  const filas = useMemo(
    () => generarFilas(vehiculo?.capacidadTotal || 12),
    [vehiculo?.capacidadTotal]
  );
  const capacidadPasajeros = (vehiculo?.capacidadTotal || 12) - 2;
  const asientosChofer = vehiculo?.asientosChofer?.length
    ? vehiculo.asientosChofer
    : [1, 2];

  const origen = NOMBRES[tramo];
  const destino = tramo === "cochabamba" ? "Eterazama" : "Cochabamba";

  function seleccionarVehiculo(v: VehiculoBoleteria, nuevaParada: "cochabamba" | "eterazama") {
    setTramo(nuevaParada);
    setError("");
    setAviso("");
    setAsientosSel([]);
    setPasajeros({});
    setVehiculo(v);
    setPaso("asientos");
  }

  function toggleAsiento(num: number) {
    if (asientosChofer.includes(num)) return;
    if (ocupados.includes(num)) return;
    if (num < 3 || num > capacidadPasajeros + 2) return;
    setAsientosSel((prev) => {
      const esta = prev.includes(num);
      const nuevos = esta ? prev.filter((a) => a !== num) : [...prev, num];
      setPasajeros((pas) => {
        const copia = { ...pas };
        if (esta) delete copia[num];
        return copia;
      });
      return nuevos;
    });
  }

  function renderAsiento(num: number) {
    const ocupado = ocupados.includes(num);
    const seleccionado = asientosSel.includes(num);
    if (ocupado) {
      return (
        <button
          key={num}
          type="button"
          onClick={() => verOcupado(num)}
          title="Ver pasajero y pasaje"
          className={`w-14 h-14 rounded-lg text-xs font-medium transition-all cursor-pointer border bg-red-600/20 text-red-400 border-red-600/20 hover:bg-red-600/30`}
        >
          {num}
        </button>
      );
    }
    return (
      <button
        key={num}
        type="button"
        onClick={() => toggleAsiento(num)}
        className={`w-14 h-14 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
          seleccionado
            ? "bg-sky-600 text-white ring-2 ring-sky-400 shadow-lg shadow-sky-600/30 border-sky-500 scale-105"
            : "bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white border-gray-700"
        }`}
      >
        {num}
      </button>
    );
  }

  function codigoDe(p: Pasaje): string {
    return p.codigo || p.id.substring(0, 8).toUpperCase();
  }

  function verOcupado(num: number) {
    if (!vehiculo?.pasajes) return;
    const pasaje = vehiculo.pasajes.find((p) => (p.asientos || []).includes(num));
    if (!pasaje) return;
    setDetalleOcupado({ pasaje, asiento: num });
    setMotivoReembolso("");
    setErrorReembolso("");
  }

  async function procesarReembolso() {
    if (!detalleOcupado) return;
    const { pasaje } = detalleOcupado;
    const motivo = motivoReembolso.trim();
    const monto = Number(pasaje.montoTotal || 0).toFixed(2);
    const cod = codigoDe(pasaje);
    const confirmacion = motivo
      ? `¿Confirmar reembolso de Bs ${monto} al pasaje ${cod}?\nMotivo: ${motivo}`
      : `¿Confirmar reembolso de Bs ${monto} al pasaje ${cod}?`;
    if (!window.confirm(confirmacion)) return;
    setCargandoReembolso(true);
    setErrorReembolso("");
    try {
      await confirmarReembolsoSecretaria(pasaje.id, motivo);
      setDetalleOcupado(null);
      setMotivoReembolso("");
      await refrescarVehiculo();
      cargar();
    } catch (e) {
      setErrorReembolso(extraerError(e));
      await refrescarVehiculo();
    } finally {
      setCargandoReembolso(false);
    }
  }

  function nombresCompletos(): boolean {
    if (!recibo.nombre.trim()) return false;
    if (asientosSel.length === 0) return false;
    return asientosSel.every((a) => (pasajeros[a] || "").trim());
  }

  async function refrescarVehiculo() {
    if (!vehiculo?.id) return;
    try {
      const actualizado = await obtenerVehiculoBoleteria(vehiculo.id);
      setVehiculo(actualizado);
      const oc = actualizado.asientosOcupados || [];
      setAsientosSel((prev) => prev.filter((a) => !oc.includes(a)));
    } catch (e) {
      console.error(e);
    }
  }

  async function confirmarVenta() {
    if (!vehiculo?.id) return;
    setError("");
    setCargandoVenta(true);
    try {
      const resultado = await venderBoleteria({
        vehiculoId: vehiculo.id,
        asientos: [...asientosSel].sort((a, b) => a - b),
        pasajeros: asientosSel.map((a) => ({
          asiento: a,
          nombre: (pasajeros[a] || "").trim(),
        })),
        tramo,
        contactoRecibo: recibo.nombre.trim(),
        ciRecibo: recibo.ci.trim() || undefined,
        telefonoRecibo: recibo.telefono.trim() || undefined,
        montoEncomienda: encomienda,
        metodoPago: "EFECTIVO",
      });
      setVenta(resultado);
      setPaso("confirmacion");
      cargar();
    } catch (e) {
      setError(extraerError(e));
      await refrescarVehiculo();
      setPaso("asientos");
    } finally {
      setCargandoVenta(false);
    }
  }

  function nuevaVenta() {
    setPaso("paradas");
    setVehiculo(null);
    setAsientosSel([]);
    setPasajeros({});
    setRecibo({ nombre: "", ci: "", telefono: "" });
    setMontoEncomienda("");
    setVenta(null);
    setError("");
    setAviso("");
    setMostrarComprobante(false);
  }

  const vueltasOrdenados = [...asientosSel].sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Boletería</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Venta de pasajes en ventanilla · Pago en efectivo
          </p>
        </div>
        {paso !== "paradas" && (
          <button
            onClick={nuevaVenta}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer border border-gray-700"
          >
            <X className="w-4 h-4" /> Nueva venta
          </button>
        )}
      </div>

      {/* Barra de pasos */}
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
        {PASOS.map((p, idx) => {
          const activo = PASOS.findIndex((s) => s.id === paso) >= idx;
          const actual = p.id === paso;
          return (
            <div key={p.id} className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                  actual
                    ? "bg-sky-600/20 text-sky-400 border-sky-500/40"
                    : activo
                    ? "bg-emerald-600/15 text-emerald-400 border-emerald-500/30"
                    : "bg-gray-900 text-gray-500 border-gray-800"
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    actual
                      ? "bg-sky-500 text-white"
                      : activo
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {idx + 1}
                </span>
                {p.label}
              </div>
              {idx < PASOS.length - 1 && (
                <div className={`w-4 sm:w-6 h-0.5 ${activo && !actual ? "bg-emerald-500" : "bg-gray-800"}`} />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {aviso && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-3 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {aviso}
        </div>
      )}

      {cargando && !paradas ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-400 text-sm">Cargando boletería...</p>
        </div>
      ) : paso === "paradas" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {(["cochabamba", "eterazama"] as const).map((parada) => {
            const lista = parada === "cochabamba" ? paradas?.cochabamba || [] : paradas?.eterazama || [];
            const esCochabamba = parada === "cochabamba";
            return (
              <div
                key={parada}
                className={`bg-gray-900 border rounded-2xl p-4 space-y-3 ${
                  esCochabamba ? "border-emerald-500/20" : "border-amber-500/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      esCochabamba ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400"
                    }`}
                  >
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white">{esCochabamba ? "Cochabamba" : "Eterazama"}</h2>
                    <p className="text-[11px] text-gray-500">
                      {esCochabamba
                        ? `→ Eterazama · Bs ${paradas?.precios?.cochabamba ?? 0} por asiento`
                        : `→ Cochabamba · Bs ${paradas?.precios?.eterazama ?? 0} por asiento`}
                    </p>
                  </div>
                  <span className="ml-auto bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">
                    {lista.length} trufi{lista.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {lista.length === 0 ? (
                  <div className="py-10 text-center bg-gray-950/50 rounded-xl">
                    <Car className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-500 text-xs">No hay trufis en esta parada</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {lista.map((v) => {
                      const disponibles = v.asientosLibres || 0;
                      return (
                        <button
                          key={v.id}
                          onClick={() => seleccionarVehiculo(v, parada)}
                          className="w-full bg-gray-800/70 hover:bg-gray-800 border border-gray-700/60 hover:border-sky-500/50 rounded-xl p-3 text-left transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sky-400 font-mono font-bold text-sm">{v.placa}</span>
                                <EstadoBadge estado={v.estadoVehiculo || v.estadoViaje || ""} />
                              </div>
                              <p className="text-xs text-gray-300 mt-1 truncate">
                                <User className="w-3 h-3 inline mr-1 -mt-0.5" />
                                {v.choferNombre}
                              </p>
                              <p className="text-[11px] text-gray-500 mt-0.5 capitalize">
                                {v.tipoVehiculo} · {v.color}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={`text-lg font-bold ${disponibles > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {disponibles}
                              </p>
                              <p className="text-[9px] text-gray-500">libres</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-3">
                            <div className="bg-gray-900/80 rounded-lg py-1.5 text-center">
                              <p className="text-[9px] text-gray-500">Ocupados</p>
                              <p className="text-sm font-semibold text-white">{v.ocupadosTotal}</p>
                            </div>
                            <div className="bg-gray-900/80 rounded-lg py-1.5 text-center">
                              <p className="text-[9px] text-gray-500">Libres</p>
                              <p className="text-sm font-semibold text-emerald-400">{disponibles}</p>
                            </div>
                            <div className="bg-gray-900/80 rounded-lg py-1.5 text-center">
                              <p className="text-[9px] text-gray-500">Capacidad</p>
                              <p className="text-sm font-semibold text-gray-300">{v.capacidadTotal}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {paso === "asientos" && vehiculo && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-sky-500/10 rounded-xl flex items-center justify-center">
                <Car className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sky-400 font-mono font-bold">{vehiculo.placa}</span>
                  <EstadoBadge estado={vehiculo.estadoVehiculo || ""} />
                </div>
                <p className="text-sm text-gray-300">
                  {vehiculo.choferNombre} · {vehiculo.tipoVehiculo} {vehiculo.color}
                </p>
                <p className="text-[11px] text-gray-500">
                  {origen} <ArrowRight className="w-3 h-3 inline" /> {destino} · Bs {precioUnitario} por asiento
                </p>
              </div>
            </div>
            <div className="flex gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-white">{vehiculo.capacidadTotal}</p>
                <p className="text-[10px] text-gray-500">Capacidad</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-400">{vehiculo.ocupadosTotal}</p>
                <p className="text-[10px] text-gray-500">Ocupados</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-400">{vehiculo.asientosLibres}</p>
                <p className="text-[10px] text-gray-500">Libres</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Armchair className="w-5 h-5 text-sky-400" /> Seleccionar asientos
              </h2>
              <div className="flex flex-col items-center gap-1.5 max-w-sm mx-auto">
                <div className="bg-gray-700 rounded-t-xl w-full py-2 text-center text-[10px] text-gray-300 font-bold tracking-widest">
                  FRENTE
                </div>
                <div className="flex flex-col items-center gap-1.5 w-full">
                  {filas.map((fila, fi) => (
                    <div key={fi} className="flex justify-center gap-1.5">
                      {fila.map((num) =>
                        asientosChofer.includes(num) ? (
                          <div
                            key={num}
                            title="Asiento del chofer"
                            className="w-14 h-14 rounded-lg bg-amber-600/25 text-amber-400 border border-amber-600/40 flex flex-col items-center justify-center text-[8px] font-semibold"
                          >
                            <User className="w-4 h-4 mb-0.5" />
                            CHOFER
                          </div>
                        ) : (
                          renderAsiento(num)
                        )
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-[11px] text-gray-500 mt-4 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-3.5 bg-amber-600/25 rounded border border-amber-600/40" /> Chofer
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-3.5 bg-gray-800 rounded border border-gray-700" /> Libre
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-3.5 bg-sky-600 rounded" /> Seleccionado
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3.5 h-3.5 bg-red-600/30 rounded border border-red-600/20" /> Ocupado
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-emerald-400" /> Resumen de la venta
                </h2>

                <div className="space-y-2 bg-gray-800 rounded-xl p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Asientos seleccionados</span>
                    <span className="text-white font-medium">
                      {asientosSel.length === 0 ? "-" : asientosSel.slice().sort((a, b) => a - b).join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Pasajeros</span>
                    <span className="text-white font-medium">{asientosSel.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Precio por asiento</span>
                    <span className="text-gray-300">Bs {precioUnitario}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Subtotal pasajes</span>
                    <span className="text-white font-semibold">Bs {subtotal}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" /> Encomienda (Bs)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={montoEncomienda}
                      onChange={(e) => setMontoEncomienda(e.target.value)}
                      placeholder="0"
                      className="w-28 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-right"
                    />
                  </div>
                  <hr className="border-gray-700" />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-semibold">TOTAL A PAGAR</span>
                    <span className="text-green-400 font-bold text-xl">Bs {total}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl px-4 py-3 text-xs">
                  <DollarSign className="w-4 h-4 shrink-0" />
                  Pago en efectivo en ventanilla
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPaso("paradas")}
                  className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-xl text-sm transition-colors cursor-pointer border border-gray-700"
                >
                  <ArrowLeft className="w-4 h-4" /> Volver
                </button>
                <button
                  onClick={() => {
                    setError("");
                    setAviso("");
                    setPaso("pasajeros");
                  }}
                  disabled={asientosSel.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
                >
                  Continuar con {asientosSel.length} asiento{asientosSel.length !== 1 ? "s" : ""}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {paso === "pasajeros" && vehiculo && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-amber-400" /> Datos del recibo
            </h2>
            <p className="text-xs text-gray-400">Nombre de la persona que recibe el recibo</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Nombre completo *</label>
                <input
                  value={recibo.nombre}
                  onChange={(e) => setRecibo({ ...recibo, nombre: e.target.value })}
                  placeholder="Nombre de quien recibe"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">CI (opcional)</label>
                <input
                  value={recibo.ci}
                  onChange={(e) => setRecibo({ ...recibo, ci: e.target.value })}
                  placeholder="1234567"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-1">Teléfono (opcional)</label>
                <input
                  value={recibo.telefono}
                  onChange={(e) => setRecibo({ ...recibo, telefono: e.target.value })}
                  placeholder="71234567"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-sky-400" /> Pasajeros por asiento
            </h2>
            <p className="text-xs text-gray-400">
              {vehiculo.placa} · {origen} <ArrowRight className="w-3 h-3 inline" /> {destino}
            </p>
            <div className="space-y-3">
              {vueltasOrdenados.map((asiento) => (
                <div key={asiento} className="flex items-center gap-3 bg-gray-800 rounded-xl p-3">
                  <div className="w-11 h-11 bg-sky-600/20 rounded-lg flex items-center justify-center shrink-0">
                    <span className="text-sky-400 font-mono font-bold text-sm">{asiento}</span>
                  </div>
                  <div className="flex-1">
                    <label className="block text-[10px] text-gray-500 mb-0.5">Nombre del pasajero - Asiento {asiento} *</label>
                    <input
                      value={pasajeros[asiento] || ""}
                      onChange={(e) => setPasajeros((prev) => ({ ...prev, [asiento]: e.target.value }))}
                      placeholder="Nombre completo del pasajero"
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setPaso("asientos")}
              className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-xl text-sm transition-colors cursor-pointer border border-gray-700"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <button
              onClick={() => setPaso("resumen")}
              disabled={!nombresCompletos()}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              Ver resumen de venta <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {paso === "resumen" && vehiculo && (
        <div className="space-y-4 max-w-3xl">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-sky-400" /> Resumen final de la venta
            </h2>

            <div className="bg-gray-800 rounded-xl p-5 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Parada de salida</span>
                <span className="text-white font-medium">{origen}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Destino</span>
                <span className="text-white font-medium">{destino}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tramo</span>
                <span className="text-white font-medium">
                  {origen} <ArrowRight className="w-3 h-3 inline" /> {destino}
                </span>
              </div>
              <hr className="border-gray-700" />
              <div className="flex justify-between">
                <span className="text-gray-400">Vehículo</span>
                <span className="text-white capitalize">{vehiculo.tipoVehiculo} {vehiculo.color}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Placa</span>
                <span className="text-sky-400 font-mono font-semibold">{vehiculo.placa}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Chofer</span>
                <span className="text-white font-medium">{vehiculo.choferNombre}</span>
              </div>
              <hr className="border-gray-700" />
              <div>
                <p className="text-xs text-gray-500 mb-1.5">Asientos y pasajeros</p>
                {vueltasOrdenados.map((a) => (
                  <div key={a} className="flex justify-between text-sm">
                    <span className="text-gray-400">Asiento {a}</span>
                    <span className="text-white">{(pasajeros[a] || "").trim()}</span>
                  </div>
                ))}
              </div>
              <hr className="border-gray-700" />
              <div className="flex justify-between">
                <span className="text-gray-400">Recibe el recibo</span>
                <span className="text-white font-medium">{recibo.nombre.trim()}</span>
              </div>
              {recibo.ci.trim() && (
                <div className="flex justify-between">
                  <span className="text-gray-400">CI</span>
                  <span className="text-gray-300">{recibo.ci.trim()}</span>
                </div>
              )}
              {recibo.telefono.trim() && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Teléfono</span>
                  <span className="text-gray-300">{recibo.telefono.trim()}</span>
                </div>
              )}
              <hr className="border-gray-700" />
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal pasajes ({asientosSel.length} x Bs {precioUnitario})</span>
                <span className="text-white font-semibold">Bs {subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Encomienda</span>
                <span className="text-white">Bs {encomienda}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-700 pt-2 mt-1">
                <span className="text-gray-300 font-bold">TOTAL A PAGAR</span>
                <span className="text-green-400 font-bold text-2xl">Bs {total}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-emerald-500/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Pago en efectivo</h3>
                <p className="text-xs text-gray-400">
                  El cliente paga en ventanilla. No se requiere QR ni pago digital.
                </p>
              </div>
              <span className="ml-auto w-5 h-5 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
              </span>
            </div>

            <button
              onClick={confirmarVenta}
              disabled={cargandoVenta}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-bold transition-colors cursor-pointer text-base"
            >
              {cargandoVenta ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Registrando venta...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" /> Cobrar Bs {total} en efectivo y confirmar venta
                </>
              )}
            </button>
          </div>

          <div className="flex">
            <button
              onClick={() => setPaso("pasajeros")}
              className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-xl text-sm transition-colors cursor-pointer border border-gray-700"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
          </div>
        </div>
      )}

      {paso === "confirmacion" && venta && (
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="bg-gray-900 border border-emerald-500/30 rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-400/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-9 h-9 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Venta Registrada</h2>
              <p className="text-gray-400 text-sm mt-0.5">Pago en efectivo recibido en ventanilla</p>
            </div>

            <div className="inline-flex flex-col items-center bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-8 py-4">
              <span className="text-[10px] text-emerald-400/70 font-medium uppercase tracking-widest">Código de pasaje</span>
              <span className="text-2xl font-mono font-bold text-emerald-300">{venta.codigo || venta.id.substring(0, 8).toUpperCase()}</span>
            </div>

            <div className="bg-gray-800 rounded-xl p-5 text-left space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Ruta</span>
                <span className="text-white font-medium">{venta.origen || origen} <ArrowRight className="w-3 h-3 inline" /> {venta.destino || destino}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Vehículo</span>
                <span className="text-white capitalize">{vehiculo?.tipoVehiculo} {vehiculo?.color}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Placa</span>
                <span className="text-sky-400 font-mono font-semibold">{venta.placaVehiculo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Chofer</span>
                <span className="text-white">{vehiculo?.choferNombre}</span>
              </div>
              <hr className="border-gray-700" />
              {vueltasOrdenados.map((a) => (
                <div key={a} className="flex justify-between">
                  <span className="text-gray-400">Asiento {a}</span>
                  <span className="text-white">{(pasajeros[a] || "").trim()}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-gray-400">Recibe el recibo</span>
                <span className="text-white">{recibo.nombre.trim()}</span>
              </div>
              <hr className="border-gray-700" />
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal pasajes</span>
                <span className="text-white">Bs {venta.montoAsientos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Encomienda</span>
                <span className="text-white">Bs {venta.montoEncomienda}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Método de pago</span>
                <span className="text-emerald-400 font-semibold uppercase">{venta.metodoPago || "EFECTIVO"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fecha y hora</span>
                <span className="text-gray-300">
                  {new Date(venta.fechaCreacion || Date.now()).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-700 pt-2 mt-1">
                <span className="text-gray-300 font-bold">TOTAL RECIBIDO</span>
                <span className="text-green-400 font-bold text-xl">Bs {venta.montoTotal}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setMostrarComprobante(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Imprimir comprobante
              </button>
              <button
                onClick={nuevaVenta}
                className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Volver a Boletería
              </button>
            </div>
          </div>
        </div>
      )}
      {mostrarComprobante && venta && (
        <ComprobantePreview
          venta={venta}
          vehiculoNombre={`${vehiculo?.tipoVehiculo || ""} ${vehiculo?.color || ""}`.trim()}
          vehiculoPlaca={venta.placaVehiculo}
          choferNombre={vehiculo?.choferNombre || ""}
          origen={venta.origen || origen}
          destino={venta.destino || destino}
          asientos={asientosSel.length > 0 ? asientosSel : (venta.asientos || [])}
          nombreRecibo={recibo.nombre.trim() || venta.contactoRecibo || ""}
          precioUnitario={precioUnitario}
          subtotalPasajes={venta.montoAsientos}
          encomienda={venta.montoEncomienda}
          total={venta.montoTotal}
          onClose={() => setMostrarComprobante(false)}
        />
      )}

      {detalleOcupado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Detalle del pasaje</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Placa <span className="text-sky-400 font-mono">{detalleOcupado.pasaje.placaVehiculo}</span> · Asiento{" "}
                  <span className="text-red-400 font-mono">{detalleOcupado.asiento}</span>
                </p>
              </div>
              <button onClick={() => setDetalleOcupado(null)} className="text-gray-500 hover:text-white cursor-pointer" title="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 text-sm bg-gray-800 rounded-xl p-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Código</span>
                <span className="text-sky-400 font-mono font-semibold">{codigoDe(detalleOcupado.pasaje)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Ruta</span>
                <span className="text-white">
                  {detalleOcupado.pasaje.origen || detalleOcupado.pasaje.tramo}{" "}
                  <ArrowRight className="w-3 h-3 inline" />{" "}
                  {detalleOcupado.pasaje.destino || detalleOcupado.pasaje.tramo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Pasajero</span>
                <span className="text-white capitalize">
                  {detalleOcupado.pasaje.pasajeros?.find((x) => x.asiento === detalleOcupado.asiento)?.nombre ||
                    detalleOcupado.pasaje.pasajeroNombre}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Recibo</span>
                <span className="text-white">{detalleOcupado.pasaje.contactoRecibo || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Método de pago</span>
                <span className="text-emerald-400 uppercase">{detalleOcupado.pasaje.metodoPago || "EFECTIVO"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fecha de venta</span>
                <span className="text-gray-300">
                  {detalleOcupado.pasaje.fechaCreacion ? new Date(detalleOcupado.pasaje.fechaCreacion).toLocaleString() : "-"}
                </span>
              </div>
              <hr className="border-gray-700" />
              <div className="flex justify-between">
                <span className="text-gray-400">Monto pasajes</span>
                <span className="text-white">Bs {Number(detalleOcupado.pasaje.montoAsientos || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Encomienda</span>
                <span className="text-white">Bs {Number(detalleOcupado.pasaje.montoEncomienda || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-700 pt-2">
                <span className="text-gray-300 font-bold">TOTAL</span>
                <span className="text-green-400 font-bold text-lg">Bs {Number(detalleOcupado.pasaje.montoTotal || 0).toFixed(2)}</span>
              </div>
            </div>

            {detalleOcupado.pasaje.estadoReembolso === "REEMBOLSADO" && (
              <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Pasaje REEMBOLSADO
                </p>
                <p>Monto: Bs {Number(detalleOcupado.pasaje.montoReembolsado ?? detalleOcupado.pasaje.montoTotal ?? 0).toFixed(2)}</p>
                <p>Secretaría: {detalleOcupado.pasaje.secretariaReembolso || "-"}</p>
                <p>Fecha: {detalleOcupado.pasaje.fechaReembolso ? new Date(detalleOcupado.pasaje.fechaReembolso).toLocaleString() : "-"}</p>
                {detalleOcupado.pasaje.motivoCancelacion && <p>Motivo: {detalleOcupado.pasaje.motivoCancelacion}</p>}
              </div>
            )}

            {detalleOcupado.pasaje.estadoReembolso !== "REEMBOLSADO" && (
              detalleOcupado.pasaje.puedeReembolsar === false ? (
                <div className="mt-3 flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
                  <Ban className="w-4 h-4 shrink-0" />
                  El vehículo está <span className="font-bold">EN RUTA</span>. No se permiten reembolsos mientras dure la ruta.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {errorReembolso && (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
                      <AlertTriangle className="w-4 h-4 shrink-0" /> {errorReembolso}
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Motivo del reembolso</label>
                    <input
                      value={motivoReembolso}
                      onChange={(e) => setMotivoReembolso(e.target.value)}
                      placeholder="Ej. El pasajero no viajará"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    onClick={procesarReembolso}
                    disabled={cargandoReembolso}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {cargandoReembolso ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Procesando reembolso...
                      </>
                    ) : (
                      <>
                        <Undo2 className="w-4 h-4" /> Procesar reembolso (Bs {Number(detalleOcupado.pasaje.montoTotal || 0).toFixed(2)})
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-gray-500 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-400/80" />
                    La confirmación marca el pasaje como REEMBOLSADO, libera el asiento y descuenta el monto de Caja automáticamente.
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}