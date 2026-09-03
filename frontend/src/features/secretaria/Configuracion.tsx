import { useEffect, useState } from "react";
import { Settings, Save, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import {
  obtenerConfiguracionSecretaria,
  actualizarConfiguracionSecretaria,
} from "../../api/secretaria.api";

function mensajeError(e: unknown): string {
  const error = e as {
    response?: {
      data?: {
        message?: string | string[];
      };
    };
  };
  const mensaje = error?.response?.data?.message;
  if (Array.isArray(mensaje)) return mensaje[0] || "Error al guardar la configuración";
  return mensaje || "Error al guardar la configuración";
}

export default function Configuracion() {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState("");
  const [error, setError] = useState("");
  const [config, setConfig] = useState({
    nombreSindicato: "Sindicato Mixto Trans Eterazama",
    telefono: "",
    email: "",
    direccion: "",
    precioCochabamba: "",
    precioEterazama: "",
    horarioApertura: "05:00",
    horarioCierre: "22:00",
  });

  useEffect(() => {
    obtenerConfiguracionSecretaria()
      .then((c) => {
        setConfig({
          nombreSindicato: c.nombreSindicato,
          telefono: c.telefono || "",
          email: c.email || "",
          direccion: c.direccion || "",
          precioCochabamba: String(c.precioCochabamba),
          precioEterazama: String(c.precioEterazama),
          horarioApertura: c.horarioApertura || "05:00",
          horarioCierre: c.horarioCierre || "22:00",
        });
      })
      .catch((e) => setError(mensajeError(e)))
      .finally(() => setCargando(false));
  }, []);

  function cambiar(e: React.ChangeEvent<HTMLInputElement>) {
    setConfig({ ...config, [e.target.name]: e.target.value });
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setExito("");

    const precioCochabamba = Number(config.precioCochabamba);
    const precioEterazama = Number(config.precioEterazama);

    if (
      !Number.isFinite(precioCochabamba) ||
      precioCochabamba <= 0 ||
      !Number.isFinite(precioEterazama) ||
      precioEterazama <= 0
    ) {
      setError("Los precios deben ser números mayores a cero.");
      return;
    }

    setGuardando(true);
    try {
      await actualizarConfiguracionSecretaria({
        nombreSindicato: config.nombreSindicato.trim(),
        telefono: config.telefono.trim(),
        email: config.email.trim(),
        direccion: config.direccion.trim(),
        precioCochabamba,
        precioEterazama,
        horarioApertura: config.horarioApertura,
        horarioCierre: config.horarioCierre,
      });
      setExito("Configuración guardada. Los nuevos precios se aplican de inmediato en Boletería.");
      setTimeout(() => setExito(""), 4000);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
        <Loader2 className="w-8 h-8 text-sky-400 animate-spin mx-auto mb-2" />
        <p className="text-gray-400 text-sm">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configuración del Sindicato</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Administra la información general y los precios oficiales de pasajes
        </p>
      </div>

      {exito && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-3 rounded-xl text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> {exito}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={guardar} className="space-y-5">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-5 h-5 text-sky-400" />
            <h2 className="text-lg font-semibold text-white">Información General</h2>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Nombre del sindicato</label>
            <input
              name="nombreSindicato"
              value={config.nombreSindicato}
              onChange={cambiar}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Teléfono</label>
              <input
                name="telefono"
                value={config.telefono}
                onChange={cambiar}
                placeholder="4567890"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                name="email"
                type="email"
                value={config.email}
                onChange={cambiar}
                placeholder="sindicato@email.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Dirección</label>
            <input
              name="direccion"
              value={config.direccion}
              onChange={cambiar}
              placeholder="Dirección del sindicato"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-lg font-semibold text-white">Precios de Pasajes</h2>
          </div>
          <p className="text-xs text-gray-500">
            Estos precios son la fuente de verdad. Boletería los aplica automáticamente en cada venta.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Cochabamba → Eterazama (Bs)
              </label>
              <input
                name="precioCochabamba"
                type="number"
                min="0.5"
                step="0.5"
                value={config.precioCochabamba}
                onChange={cambiar}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Eterazama → Cochabamba (Bs)
              </label>
              <input
                name="precioEterazama"
                type="number"
                min="0.5"
                step="0.5"
                value={config.precioEterazama}
                onChange={cambiar}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Horarios</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Hora de apertura</label>
              <input
                name="horarioApertura"
                type="time"
                value={config.horarioApertura}
                onChange={cambiar}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Hora de cierre</label>
              <input
                name="horarioCierre"
                type="time"
                value={config.horarioCierre}
                onChange={cambiar}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={guardando}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-800 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
        >
          {guardando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" /> Guardar configuración
            </>
          )}
        </button>
      </form>
    </div>
  );
}