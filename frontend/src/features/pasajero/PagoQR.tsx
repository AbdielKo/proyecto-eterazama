import { useState } from "react";
import { QrCode } from "lucide-react";

interface Props {
  monto: number;
  onPagar: () => void;
}

export default function PagoQR({ monto, onPagar }: Props) {
  const [procesando, setProcesando] = useState(false);

  async function pagar() {
    setProcesando(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    onPagar();
    setProcesando(false);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md mx-auto text-center space-y-4">
      <QrCode className="w-16 h-16 text-sky-400 mx-auto" />
      <h3 className="text-xl font-bold text-white">Pago por QR</h3>
      <p className="text-gray-400">Escanea el codigo QR para realizar el pago</p>

      <div className="bg-gray-800 rounded-xl p-4">
        <p className="text-sm text-gray-400">Monto a pagar</p>
        <p className="text-3xl font-bold text-green-400">Bs {monto}</p>
      </div>

      <div className="bg-gray-800 rounded-xl p-6">
        <div className="w-40 h-40 bg-white rounded-xl mx-auto flex items-center justify-center">
          <QrCode className="w-32 h-32 text-gray-900" />
        </div>
        <p className="text-xs text-gray-500 mt-2">Codigo QR de ejemplo</p>
      </div>

      <button
        onClick={pagar}
        disabled={procesando}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 text-white font-semibold py-3 rounded-xl transition-colors cursor-pointer"
      >
        {procesando ? "Procesando pago..." : "Confirmar Pago"}
      </button>
    </div>
  );
}
