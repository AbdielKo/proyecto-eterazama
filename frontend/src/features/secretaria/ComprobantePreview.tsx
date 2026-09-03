import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import type { Pasaje } from "../../types/pasaje";

interface ComprobantePreviewProps {
  venta: Pasaje;
  vehiculoNombre: string;
  vehiculoPlaca: string;
  choferNombre: string;
  origen: string;
  destino: string;
  asientos: number[];
  nombreRecibo: string;
  precioUnitario: number;
  subtotalPasajes: number;
  encomienda: number;
  total: number;
  onClose: () => void;
}

export default function ComprobantePreview({
  venta,
  vehiculoNombre,
  vehiculoPlaca,
  choferNombre,
  origen,
  destino,
  asientos,
  nombreRecibo,
  precioUnitario,
  subtotalPasajes,
  encomienda,
  total,
  onClose,
}: ComprobantePreviewProps) {
  const codigo = venta.codigo || venta.id.substring(0, 8).toUpperCase();
  const fecha = new Date(venta.fechaCreacion || "");
  const fechaValida = !Number.isNaN(fecha.getTime());
  const fechaStr = fechaValida
    ? fecha.toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
  const horaStr = fechaValida
    ? fecha.toLocaleTimeString("es-BO", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  function handleImprimir() {
    window.print();
  }

  const pasajerosPorAsiento = (venta.pasajeros || []).reduce<
    Record<number, string>
  >((acc, p) => {
    acc[p.asiento] = p.nombre;
    return acc;
  }, {});
  const asientosOrdenados = [...asientos]
    .sort((a, b) => a - b)
    .map((a) => ({
      asiento: a,
      nombre:
        pasajerosPorAsiento[a] ||
        (venta.pasajeros || []).find((p) => p.asiento === a)?.nombre ||
        "",
    }));

  const comprobanteContent = (
    <>
      {/* Header */}
      <div className="text-center border-b-2 border-dashed border-gray-300 pb-3 pt-4 px-4">
        <h1
          className="font-bold text-sm tracking-wide uppercase"
          style={{ color: "#1a1a1a" }}
        >
          Sindicato Mixto Trans Eterazama
        </h1>
        <p className="text-[10px] text-gray-500 mt-1 tracking-wider uppercase">
          Comprobante de pasaje
        </p>
      </div>

      {/* Codigo */}
      <div className="text-center py-3 border-b border-dashed border-gray-300 px-4">
        <p className="text-[9px] text-gray-400 uppercase tracking-widest font-medium">
          Codigo
        </p>
        <p
          className="text-lg font-bold tracking-wider mt-0.5"
          style={{ fontFamily: "monospace", color: "#0e7490" }}
        >
          {codigo}
        </p>
      </div>

      {/* Ruta */}
      <div className="px-4 py-3 border-b border-dashed border-gray-300">
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-gray-700">
          <span>{origen}</span>
          <span className="text-gray-400">&#8594;</span>
          <span>{destino}</span>
        </div>
      </div>

      {/* Datos del servicio */}
      <div className="px-4 py-3 space-y-1.5 border-b border-dashed border-gray-300">
        <Row label="Vehiculo" value={vehiculoNombre} />
        <Row label="Placa" value={vehiculoPlaca} bold mono />
        {choferNombre && (
          <Row label="Conductor" value={choferNombre} />
        )}
        <Row label="Recibe el recibo" value={nombreRecibo} />
        {asientosOrdenados.map(({ asiento, nombre }) => (
          <Row key={asiento} label={`Asiento ${asiento}`} value={nombre} />
        ))}
        <Row label="Cantidad" value={`${asientosOrdenados.length} pasajero${asientosOrdenados.length !== 1 ? "s" : ""}`} />
      </div>

      {/* Desglose */}
      <div className="px-4 py-3 space-y-1.5 border-b border-dashed border-gray-300">
        <Row
          label={`Pasajes (${asientos.length} x Bs ${precioUnitario})`}
          value={`Bs ${subtotalPasajes}`}
        />
        {encomienda > 0 && (
          <Row label="Encomienda" value={`Bs ${encomienda}`} />
        )}
        <Row label="Metodo de pago" value={venta.metodoPago || "EFECTIVO"} />
        <Row label="Fecha" value={fechaStr} />
        <Row label="Hora" value={horaStr} />
      </div>

      {/* Total */}
      <div className="px-4 py-3 border-b border-dashed border-gray-300">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-gray-600 uppercase">
            Total recibido
          </span>
          <span className="text-base font-bold" style={{ color: "#16a34a" }}>
            Bs {total}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center px-4 py-3">
        <p className="text-[9px] text-gray-400 italic">
          Gracias por su compra
        </p>
        <p className="text-[8px] text-gray-300 mt-1">
          Sindicato Mixto Trans Eterazama
        </p>
      </div>
    </>
  );

  return (
    <>
      <style>{`
        .comprobante-print-portal {
          display: none;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body > * {
            display: none !important;
          }
          .comprobante-print-portal {
            display: block !important;
          }
          .comprobante-print-portal #comprobante-print-area {
            display: block !important;
            width: 72mm !important;
            max-width: 72mm !important;
            margin: 0 auto !important;
            padding: 3mm 4mm !important;
            background: white !important;
            color: #000 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      <div className="comprobante-modal-bg fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="comprobante-overlay bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
          <div className="comprobante-header flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <h2 className="text-white font-semibold text-base flex items-center gap-2">
              <Printer className="w-5 h-5 text-sky-400" />
              Vista previa del comprobante
            </h2>
            <button
              onClick={onClose}
              className="no-print text-gray-400 hover:text-white transition-colors cursor-pointer p-1 rounded-lg hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="comprobante-preview-scroll flex-1 overflow-y-auto p-5 flex justify-center">
            <div
              className="bg-white text-gray-900 rounded-xl shadow-lg w-full max-w-[340px] font-sans"
              style={{ fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif" }}
            >
              {comprobanteContent}
            </div>
          </div>

          <div className="no-print flex gap-3 px-5 py-4 border-t border-gray-700">
            <button
              onClick={onClose}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer border border-gray-600"
            >
              <X className="w-4 h-4" /> Cerrar
            </button>
            <button
              onClick={handleImprimir}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
        </div>
      </div>
      {createPortal(
        <div className="comprobante-print-portal">
          <div
            id="comprobante-print-area"
            className="bg-white text-gray-900 rounded-xl shadow-lg w-full font-sans"
            style={{ fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif" }}
          >
            {comprobanteContent}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function Row({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-[11px] leading-tight">
      <span className="text-gray-500">{label}</span>
      <span
        className={`text-right text-gray-800 ${bold ? "font-bold" : "font-medium"} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
