import { useState } from "react";
import { validarBoletoQR, confirmarAbordajeQR } from "./chofer.api";
import type { ValidacionQR } from "./chofer.types";
import { QrCode, CheckCircle, XCircle, User, MapPin, DollarSign } from "lucide-react";

export default function EscanearQR() {
  const [codigo, setCodigo] = useState("");
  const [resultado, setResultado] = useState<ValidacionQR | null>(null);
  const [error, setError] = useState("");
  const [confirmado, setConfirmado] = useState(false);

  async function handleValidar() {
    if (!codigo.trim()) return;
    setError("");
    setResultado(null);
    setConfirmado(false);
    try {
      const res = await validarBoletoQR(codigo.trim());
      setResultado(res);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al validar boleto");
    }
  }

  async function handleConfirmar() {
    if (!resultado?.boleto?.id) return;
    try {
      await confirmarAbordajeQR(resultado.boleto.id);
      setConfirmado(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Error al confirmar abordaje");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Validar boleto QR</h1>
        <p className="text-gray-400 mt-1">Escanee o ingrese el codigo QR del boleto</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <QrCode className="w-6 h-6 text-sky-400" />
          <h3 className="text-lg font-semibold text-white">Escanear boleto</h3>
        </div>

        <div className="flex gap-3">
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleValidar()}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500"
            placeholder="Ingrese o escanee el codigo QR"
          />
          <button
            onClick={handleValidar}
            className="bg-sky-600 hover:bg-sky-700 text-white px-6 py-3 rounded-lg font-medium transition-colors cursor-pointer"
          >
            Validar
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {resultado && resultado.valido && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <h3 className="text-lg font-semibold text-emerald-400">Boleto valido</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-4">
              <User className="w-5 h-5 text-sky-400" />
              <div>
                <p className="text-xs text-gray-500">Pasajero</p>
                <p className="text-sm text-white font-medium">{resultado.boleto.pasajeroNombre}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-4">
              <QrCode className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-xs text-gray-500">Asiento</p>
                <p className="text-sm text-white font-medium">#{resultado.boleto.asiento}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-4">
              <MapPin className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-xs text-gray-500">Tramo</p>
                <p className="text-sm text-white font-medium">{resultado.boleto.origen} - {resultado.boleto.destino}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl p-4">
              <DollarSign className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-xs text-gray-500">Monto</p>
                <p className="text-sm text-white font-medium">Bs {resultado.boleto.monto}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-gray-500">Estado del boleto: </span>
              <span className="text-white">{resultado.boleto.estadoBoleto}</span>
            </div>
            <div>
              <span className="text-gray-500">Estado del pago: </span>
              <span className={resultado.boleto.estadoPago === "pagado" ? "text-emerald-400" : "text-amber-400"}>
                {resultado.boleto.estadoPago}
              </span>
            </div>
          </div>

          {confirmado ? (
            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <p className="text-emerald-400 font-medium">Abordaje confirmado correctamente</p>
            </div>
          ) : (
            <button
              onClick={handleConfirmar}
              disabled={resultado.boleto.estadoPago !== "pagado"}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-xl font-medium transition-colors cursor-pointer"
            >
              Confirmar abordaje
            </button>
          )}
        </div>
      )}

      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
        <p className="text-sm text-gray-500 text-center">
          El sistema impide que un mismo boleto sea utilizado dos veces.
        </p>
      </div>
    </div>
  );
}
