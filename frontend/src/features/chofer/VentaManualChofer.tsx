import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Download,
  Loader2,
  Printer,
  RefreshCw,
  Share2,
  Ticket,
  User,
  Users,
  Wallet,
} from "lucide-react";
import DistribucionAsientos from "../../components/DistribucionAsientos";
import { normalizarConfiguracion } from "../../utils/asientos-config";
import {
  obtenerDatosVentaManual,
  realizarVentaManual,
  obtenerReciboPdf,
} from "./chofer.api";
import type { DatosVentaManualChofer } from "./chofer.types";
import type { Pasaje } from "../../types/pasaje";

type Paso = "asientos" | "pasajeros" | "resumen" | "confirmacion";

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function textoWhatsApp(venta: Pasaje): string {
  const tramo = [venta.origen, venta.destino].filter(Boolean).join(" → ");
  return (
    `Hola, le enviamos su recibo de Trans Eterazama.\n` +
    `Pasajero: ${venta.pasajeroNombre}\n` +
    (tramo ? `Ruta: ${tramo}\n` : "") +
    `Asientos: ${(venta.asientos || []).join(", ")}\n` +
    `Total: Bs ${Number(venta.montoTotal || 0).toFixed(2)}\n` +
    `\nGracias por viajar con Trans Eterazama.`
  );
}

// Formato internacional para WhatsApp: 71234567 -> 59171234567 (sin '+', wa.me
// lo usa sin el signo). El número viene SIEMPRE del guardado en la venta.
function numeroWhatsApp(pasaje: Pasaje): string {
  const t = pasaje.telefonoRecibo || "";
  const soloDigitos = t.replace(/\D/g, "");
  if (soloDigitos.length === 8) return `591${soloDigitos}`;
  if (soloDigitos.length === 11 && soloDigitos.startsWith("591")) return soloDigitos;
  return `591${soloDigitos}`;
}

// Solo presentación: muestra el número como lo introdujo el chofer (8 dígitos)
// cuando el guardado está en formato internacional +591XXXXXXXX. No se guarda
// un segundo formato.
function mostrarCelular(pasaje: Pasaje): string {
  const t = pasaje.telefonoRecibo || "";
  const soloDigitos = t.replace(/\D/g, "");
  if (soloDigitos.length === 11 && soloDigitos.startsWith("591")) {
    return soloDigitos.slice(3);
  }
  return t;
}

export default function VentaManualChofer() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosVentaManualChofer | null>(null);

  const [paso, setPaso] = useState<Paso>("asientos");
  const [asientosSeleccionados, setAsientosSeleccionados] = useState<number[]>([]);
  const [pasajeros, setPasajeros] = useState<Record<number, string>>({});
  const [celular, setCelular] = useState("");
  const [montoEncomienda, setMontoEncomienda] = useState("");

  const [vendiendo, setVendiendo] = useState(false);
  const [venta, setVenta] = useState<Pasaje | null>(null);
  const [pdfCargando, setPdfCargando] = useState(false);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const d = await obtenerDatosVentaManual();
      setDatos(d);
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || "No se pudieron cargar los datos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  function limpiar() {
    setPaso("asientos");
    setAsientosSeleccionados([]);
    setPasajeros({});
    setCelular("");
    setMontoEncomienda("");
    setVenta(null);
    setError(null);
    cargarDatos();
  }

  function toggleAsiento(numero: number) {
    setAsientosSeleccionados((actual) =>
      actual.includes(numero)
        ? actual.filter((n) => n !== numero)
        : [...actual, numero],
    );
  }

  const tramo = datos?.sentido?.tramo ?? null;
  const precioTramo =
    tramo && datos?.precios ? datos.precios[tramo] ?? 0 : 0;
  const encomienda = Number(parseFloat(montoEncomienda) || 0);
  const subtotalAsientos = precioTramo * asientosSeleccionados.length;
  const total = subtotalAsientos + encomienda;

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
      </div>
    );
  }

  if (error && !datos) {
    return (
      <div className="grid place-items-center h-64">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-gray-300 text-sm max-w-md">{error}</p>
          <button
            onClick={cargarDatos}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!datos) return null;

  // Estado de la confirmación de la venta (después del éxito).
  if (paso === "confirmacion" && venta) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
          <CheckCircle className="w-14 h-14 text-emerald-400" />
          <h2 className="text-2xl font-bold text-white">
            Venta realizada correctamente
          </h2>
          <p className="text-gray-400 text-sm">
            La venta queda registrada en Ventas y Caja, en tu historial y en la
            auditoría como venta manual del chofer.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Pasajero</span>
            <span className="text-white font-medium">
              {venta.pasajeroNombre}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Asientos</span>
            <span className="text-white font-medium">
              {(venta.asientos || []).join(", ")}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Ruta</span>
            <span className="text-white font-medium">
              {venta.origen} → {venta.destino}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Total</span>
            <span className="text-emerald-400 font-bold">
              Bs {Number(venta.montoTotal || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-sm">Celular</span>
            <span className="text-white font-mono">
              {mostrarCelular(venta) || celular || "-"}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={async () => {
              setPdfCargando(true);
              try {
                const blob = await obtenerReciboPdf(venta.id);
                const archivo = `${venta.codigo || "recibo"}-${venta.id.substring(0, 8)}.pdf`;
                descargarBlob(blob, archivo);
              } catch {
                setError("No se pudo generar el recibo PDF. Intenta de nuevo.");
              } finally {
                setPdfCargando(false);
              }
            }}
            disabled={pdfCargando}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-sky-600 hover:bg-sky-500 rounded-xl text-white font-semibold disabled:opacity-60 cursor-pointer"
          >
            {pdfCargando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Descargar recibo PDF
          </button>

          <button
            onClick={async () => {
              const texto = textoWhatsApp(venta);
              const wspUrl = `https://wa.me/${numeroWhatsApp(venta)}?text=${encodeURIComponent(texto)}`;
              try {
                let blob: Blob | null = null;
                try {
                  blob = await obtenerReciboPdf(venta.id);
                } catch {
                  blob = null;
                }
                // 1) Si el navegador/dispositivo soporta compartir archivos,
                // adjunta el PDF vía Web Share API (WhatsApp destino).
                if (
                  blob &&
                  navigator.canShare?.({
                    files: [new File([blob], "recibo.pdf", { type: "application/pdf" })],
                  })
                ) {
                  await navigator.share({
                    files: [new File([blob], "recibo.pdf", { type: "application/pdf" })],
                    text: texto,
                  });
                  return;
                }
                // 2) Fallback: descargar el PDF y abrir WhatsApp con el número
                // del pasajero y el mensaje preparado. WhatsApp NO adjunta el
                // PDF solo con la URL; el chofer debe adjuntarlo manualmente.
                if (blob) {
                  descargarBlob(blob, `${venta.codigo || "recibo"}.pdf`);
                }
                window.open(wspUrl, "_blank");
                setError(
                  "PDF descargado y WhatsApp abierto con el número registrado. Adjunta el recibo PDF descargado en WhatsApp.",
                );
              } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setError("No se pudo compartir el recibo. Intenta de nuevo.");
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white font-semibold cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            Enviar recibo por WhatsApp
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={limpiar}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-xl text-gray-200 font-medium cursor-pointer"
        >
          <Ticket className="w-4 h-4" /> Nueva venta
        </button>
      </div>
    );
  }

  // Validación de reglas: el chofer ve los motivos ANTES de vender. El backend
  // vuelve a revalidarlos dentro de la transacción (no se confía en esto).
  if (!datos.permiteVenta || !datos.vehiculo) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Ticket className="w-7 h-7 text-sky-400" />
          <h1 className="text-2xl font-bold text-white">Venta manual</h1>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />
            <h2 className="text-lg font-semibold text-white">
              No puedes vender pasajes en este momento
            </h2>
          </div>
          <ul className="space-y-2">
            {(datos.motivos || []).map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-200/90">
                <span className="text-amber-400 mt-0.5">•</span>
                {m}
              </li>
            ))}
          </ul>
          {!datos.vehiculo && (
            <p className="text-sm text-amber-200/90 mt-3">
              Pide a la secretaría que asigne un vehículo a tu cuenta.
            </p>
          )}
        </div>
      </div>
    );
  }

  const config = normalizarConfiguracion(
    datos.vehiculo.configuracionAsientos,
    datos.vehiculo.capacidadTotal,
  );
  const choferAsientos = datos.vehiculo.asientosChofer || [];

  const pasosIndicador: { id: Paso; label: string }[] = [
    { id: "asientos", label: "Asientos" },
    { id: "pasajeros", label: "Pasajeros" },
    { id: "resumen", label: "Resumen" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Ticket className="w-7 h-7 text-sky-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Venta manual</h1>
            <p className="text-sm text-gray-500">
              Vende boletos sin QR desde tu vehículo · Pago en efectivo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 bg-gray-800 rounded-lg text-gray-300">
            {datos.vehiculo.placa}
          </span>
          <span className="px-2 py-1 bg-gray-800 rounded-lg text-gray-300">
            Puesto {datos.vehiculo.puestoFila}
          </span>
        </div>
      </div>

      {/* Indicador de pasos */}
      <div className="flex items-center gap-2">
        {pasosIndicador.map((p, i) => {
          const activo = paso === p.id;
          const idx = pasosIndicador.findIndex((x) => x.id === paso);
          const hecho = i < idx;
          return (
            <div key={p.id} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                  activo
                    ? "bg-sky-600 text-white"
                    : hecho
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-gray-800 text-gray-500"
                }`}
              >
                {hecho ? <CheckCircle className="w-3 h-3" /> : <span>{i + 1}</span>}
                {p.label}
              </div>
              {i < pasosIndicador.length - 1 && (
                <div className="w-5 h-px bg-gray-700" />
              )}
            </div>
          );
        })}
      </div>

      {paso === "asientos" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-sky-400" /> Sentido de venta
            </h2>
            <div className="flex flex-row items-center gap-3 px-4 py-3 rounded-xl bg-sky-600/10 border border-sky-600/40">
              <div className="flex-1 text-sm text-white">
                <span className="font-semibold">{datos.sentido?.origen}</span>
                <span className="mx-2 text-gray-400">→</span>
                <span className="font-semibold">{datos.sentido?.destino}</span>
              </div>
              <div className="text-sm text-amber-400 font-semibold">
                Bs {Number(precioTramo).toFixed(2)}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Este sentido lo define tu posición en la fila y no puede elegirse.
              El backend valida la fila y el puesto #1 en la venta.
            </p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" /> Seleccionar asientos
            </h2>
            <DistribucionAsientos
              config={config}
              asientosChofer={choferAsientos}
              asientosOcupados={datos.vehiculo.asientosOcupados}
              seleccionados={asientosSeleccionados}
              onSeleccionar={(_n, celda) => {
                if (celda.numero !== null) toggleAsiento(celda.numero);
              }}
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Seleccionados</span>
              <span className="text-white font-medium">
                {asientosSeleccionados.length} · Bs{" "}
                {Number(subtotalAsientos).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {paso === "pasajeros" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-sky-400" /> Nombres de pasajeros
            </h2>
            <p className="text-xs text-gray-500">
              Escribe el nombre de cada pasajero para su asiento.
            </p>
            {asientosSeleccionados.sort((a, b) => a - b).map((asiento) => (
              <div key={asiento} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm text-gray-400">
                  Asiento {asiento}
                </span>
                <input
                  type="text"
                  value={pasajeros[asiento] || ""}
                  onChange={(e) =>
                    setPasajeros((prev) => ({
                      ...prev,
                      [asiento]: e.target.value,
                    }))
                  }
                  placeholder="Nombre del pasajero"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            ))}
            {asientosSeleccionados.length === 0 && (
              <p className="text-sm text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Primero selecciona asientos.
              </p>
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Printer className="w-4 h-4 text-sky-400" /> Celular del pasajero
            </h2>
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="text-gray-400">Celular</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={celular}
                  onChange={(e) => setCelular(e.target.value.replace(/\D/g, ""))}
                  placeholder="71234567"
                  maxLength={8}
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
              {celular.length > 0 && !/^[67]\d{7}$/.test(celular) && (
                <p className="text-xs text-amber-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Ingresa un celular
                  boliviano de 8 dígitos (ej: 71234567).
                </p>
              )}
              <p className="text-xs text-gray-500">
                El recibo será enviado/compartido a este número mediante
                WhatsApp.
              </p>
              <label className="block">
                <span className="text-gray-400">Encomienda / carga extra</span>
                <input
                  type="number"
                  min={0}
                  value={montoEncomienda}
                  onChange={(e) => setMontoEncomienda(e.target.value)}
                  placeholder="Bs 0.00"
                  className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {paso === "resumen" && (
        <div className="max-w-lg mx-auto bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white">Confirmación de venta</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Ruta</span>
              <span className="text-white">
                {datos.sentido?.origen} → {datos.sentido?.destino}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Asiento(s)</span>
              <span className="text-white">
                {asientosSeleccionados.sort((a, b) => a - b).join(", ")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Precio (Bs {Number(precioTramo).toFixed(2)} c/u)</span>
              <span className="text-white">Bs {Number(subtotalAsientos).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Celular</span>
              <span className="text-white">{celular}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Encomienda</span>
              <span className="text-white">Bs {Number(encomienda).toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-800 pt-2">
              <span className="text-gray-400 font-medium">TOTAL (EFECTIVO)</span>
              <span className="text-emerald-400 font-bold">Bs {Number(total).toFixed(2)}</span>
            </div>
          </div>

          {asientosSeleccionados.some((a) => !(pasajeros[a] || "").trim()) && (
            <p className="text-sm text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Faltan nombres de pasajeros.
            </p>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setPaso("pasajeros")}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
            <button
              onClick={async () => {
                if (asientosSeleccionados.length === 0) {
                  setError("Selecciona al menos un asiento.");
                  return;
                }
                if (asientosSeleccionados.some((a) => !(pasajeros[a] || "").trim())) {
                  setError("Todos los asientos seleccionados necesitan un nombre.");
                  return;
                }
                if (!/^[67]\d{7}$/.test(celular)) {
                  setError("El celular debe ser un número boliviano de 8 dígitos.");
                  return;
                }
                setVendiendo(true);
                setError(null);
                try {
                  const nuevaVenta = await realizarVentaManual({
                    asientos: asientosSeleccionados.sort((a, b) => a - b),
                    pasajeros: asientosSeleccionados.sort((a, b) => a - b).map((a) => ({
                      asiento: a,
                      nombre: pasajeros[a].trim(),
                    })),
                    celular,
                    montoEncomienda: encomienda > 0 ? encomienda : undefined,
                  });
                  setVenta(nuevaVenta);
                  setPaso("confirmacion");
                } catch (e) {
                  const err = e as { response?: { data?: { message?: string } } };
                  setError(err.response?.data?.message || "No se pudo registrar la venta.");
                  cargarDatos();
                } finally {
                  setVendiendo(false);
                }
              }}
              disabled={vendiendo}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm text-white font-semibold disabled:opacity-60 cursor-pointer"
            >
              {vendiendo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Confirmar venta · Bs {Number(total).toFixed(2)}
            </button>
          </div>
        </div>
      )}

      {paso !== "confirmacion" && (
        <div className="flex justify-between">
          {paso !== "asientos" && (
            <button
              onClick={() => {
                setError(null);
                setPaso(paso === "resumen" ? "pasajeros" : "asientos");
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Volver
            </button>
          )}
          {paso === "asientos" && (
            <button
              onClick={() => {
                setError(null);
                if (asientosSeleccionados.length === 0) {
                  setError("Selecciona al menos un asiento para continuar.");
                  return;
                }
                setPaso("pasajeros");
              }}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm text-white font-medium cursor-pointer"
            >
              Continuar <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {paso === "pasajeros" && (
            <button
              onClick={() => {
                setError(null);
                if (asientosSeleccionados.some((a) => !(pasajeros[a] || "").trim())) {
                  setError("Todos los asientos seleccionados necesitan un nombre.");
                  return;
                }
                setPaso("resumen");
              }}
              className="ml-auto flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm text-white font-medium cursor-pointer"
            >
              Ver resumen <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}