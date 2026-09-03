import { Phone, Mail, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

const faq = [
  { q: "Como compro un pasaje?", a: "Ve a Comprar Pasaje, selecciona la ruta, vehiculo, asientos y confirma el pago. El proceso es 100% digital." },
  { q: "Puedo cancelar mi pasaje?", a: "Si, puedes cancelar desde Mis Pasajes antes de que el trufi salga. El reembolso se procesa en 24-48 horas." },
  { q: "Como califico al chofer?", a: "Despues de tu viaje, ve a Calificar Servicio y selecciona las estrellas con un comentario." },
  { q: "Que metodos de pago aceptan?", a: "Aceptamos pago QR y transferencia bancaria. Puedes pagar desde tu celular." },
  { q: "Como funciona el boleto digital?", a: "Despues de pagar, recibes un QR con tu boleto. Mostralo al chofer al subir." },
  { q: "Donde veo mis pasajes comprados?", a: "En la seccion Mis Pasajes puedes ver todos tus pasajes activos, completados y cancelados." },
];

export default function Ayuda() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Ayuda</h1>
        <p className="text-gray-400 text-sm mt-0.5">Soporte y contacto del sindicato</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-3">Contacto</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <Phone className="w-4 h-4 text-sky-400" /> 71234567
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <Mail className="w-4 h-4 text-sky-400" /> info@transeterazama.com
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-300">
            <MessageSquare className="w-4 h-4 text-sky-400" /> WhatsApp: 71234567
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-3">Preguntas frecuentes</h3>
        <div className="space-y-2">
          {faq.map((item, idx) => (
            <div key={idx} className="bg-gray-800 rounded-xl overflow-hidden">
              <button onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                className="w-full flex items-center justify-between p-4 text-left cursor-pointer">
                <span className="text-sm text-white font-medium">{item.q}</span>
                {openIdx === idx ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>
              {openIdx === idx && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-gray-400">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white mb-2">Reportar un problema</h3>
        <textarea rows={3} placeholder="Describe tu problema..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent mb-3" />
        <button className="bg-sky-600 hover:bg-sky-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer">Enviar reporte</button>
      </div>
    </div>
  );
}
