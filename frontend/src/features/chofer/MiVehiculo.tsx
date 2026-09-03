import { useEffect, useState } from "react";
import { obtenerMiVehiculo } from "./chofer.api";
import type { MiVehiculo, MapaAsientoChofer } from "./chofer.types";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import { Car, Palette, Hash, Users, QrCode, MapPin, Armchair, CircleDot, Fingerprint, Clock, User as UserIcon, X } from "lucide-react";

function formatFecha(fecha: string | null) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeEstado(estado: string) {
  const color = estado === "activo" ? "bg-emerald-400/10 text-emerald-400" : "bg-gray-400/10 text-gray-400";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${color}`}>{estado}</span>;
}

function badgeViaje(estado: string) {
  const colores: Record<string, string> = {
    en_ruta: "bg-sky-400/10 text-sky-400",
    fin_de_ruta: "bg-purple-400/10 text-purple-400",
    mantenimiento: "bg-amber-400/10 text-amber-400",
    inactivo: "bg-red-400/10 text-red-400",
    listo: "bg-gray-400/10 text-gray-400",
  };
  const etiquetas: Record<string, string> = {
    en_ruta: "En ruta",
    fin_de_ruta: "Fin de la ruta",
    mantenimiento: "Mantenimiento",
    inactivo: "Inactivo",
    listo: "Listo",
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${colores[estado] || "bg-gray-400/10 text-gray-400"}`}>{etiquetas[estado] || estado}</span>;
}

function estadoPasajeLabel(estado: string | null) {
  const map: Record<string, string> = {
    comprado: "Comprado",
    "pendiente de reembolso": "Pendiente de reembolso",
    reembolsado: "Reembolsado",
  };
  return estado ? map[estado] || estado : null;
}

function generarFilas(capacidadTotal: number): number[][] {
  const filas: number[][] = [];
  for (let i = 1; i <= capacidadTotal; i += 3) {
    filas.push([i, i + 1, i + 2].filter((n) => n <= capacidadTotal));
  }
  return filas;
}

type EstadoAsientoChofer = "chofer" | "bloqueado" | "disponible" | "ocupado";

function tipoEstado(a: MapaAsientoChofer): EstadoAsientoChofer {
  if (a.numero <= 1) return "chofer";
  if (a.numero === 2) return "bloqueado";
  return a.estado === "ocupado" ? "ocupado" : "disponible";
}

function estiloAsiento(tipo: EstadoAsientoChofer) {
  if (tipo === "chofer") return "bg-amber-600/30 text-amber-400 border border-amber-600/30";
  if (tipo === "bloqueado") return "bg-gray-700/50 text-gray-600 border border-gray-700";
  if (tipo === "ocupado") return "bg-red-600/20 text-red-400 border border-red-600/20";
  return "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700";
}

function claseSeleccionado(tipo: EstadoAsientoChofer, ocupadoSeleccionado: boolean) {
  if (tipo === "ocupado" && ocupadoSeleccionado) return "ring-2 ring-sky-400 bg-sky-600 text-white border-sky-500";
  return estiloAsiento(tipo);
}

export default function MiVehiculoPage() {
  const [vehiculo, setVehiculo] = useState<MiVehiculo | null>(null);
  const [asientoSeleccionado, setAsientoSeleccionado] = useState<MapaAsientoChofer | null>(null);

  function cargar() {
    obtenerMiVehiculo().then(setVehiculo).catch(console.error);
  }

  useFlotaSocket(cargar);

  useEffect(() => {
    cargar();
  }, []);

  if (!vehiculo) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Mi vehiculo</h1>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <Car className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500">No tiene vehiculo asignado</p>
        </div>
      </div>
    );
  }

  const paradaLabel = vehiculo.paradaActual === "en_ruta" ? "En ruta" : vehiculo.paradaActual === "fuera_de_fila" ? "Fuera de fila" : vehiculo.paradaActual === "eterazama" ? "Eterazama" : "Cochabamba";

  const capacidadMuestra = Math.max(4, vehiculo.capacidadTotal || 12);
  const filasAsientos = generarFilas(capacidadMuestra);
  const ocupadoSeleccionadoNumero = asientoSeleccionado?.numero;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Mi vehiculo</h1>
        <p className="text-gray-400 mt-1">Informacion completa de tu vehiculo y sus asientos</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-400/10">
              <Hash className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-xs text-gray-400">Placa</p>
          </div>
          <p className="text-2xl font-bold text-sky-400">{vehiculo.placa}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-cyan-400/10">
              <Fingerprint className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xs text-gray-400">Chofer</p>
          </div>
          <p className="text-xl font-bold text-white capitalize truncate">{vehiculo.choferNombre}</p>
          <p className="text-xs text-gray-500 mt-1">CI: {vehiculo.choferCi || "—"}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-400/10">
              <Car className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-gray-400">Tipo</p>
          </div>
          <p className="text-xl font-bold text-white capitalize">{vehiculo.tipoVehiculo}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-400/10">
              <Palette className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xs text-gray-400">Color</p>
          </div>
          <p className="text-xl font-bold text-white capitalize">{vehiculo.color}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-400/10">
              <Users className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-xs text-gray-400">Asientos</p>
          </div>
          <p className="text-xl font-bold text-white">{vehiculo.capacidadTotal}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-400/10">
              <CircleDot className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-xs text-gray-400">Ocupados</p>
          </div>
          <p className="text-xl font-bold text-red-400">{vehiculo.ocupadosTotal}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-400/10">
              <CircleDot className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-gray-400">Libres</p>
          </div>
          <p className="text-xl font-bold text-emerald-400">{vehiculo.asientosLibres}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-400/10">
              <MapPin className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-xs text-gray-400">Parada</p>
          </div>
          <p className="text-xl font-bold text-white capitalize">{paradaLabel}</p>
          <p className="text-xs text-gray-500 mt-1">Puesto #{vehiculo.puestoFila ?? "-"}</p>
          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Ingreso: {formatFecha(vehiculo.horaIngresoFila)}
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-400/10">
              <CircleDot className="w-4 h-4 text-gray-400" />
            </div>
            <p className="text-xs text-gray-400">Estado vehiculo</p>
          </div>
          {badgeEstado(vehiculo.estadoVehiculo)}
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Estado de viaje</p>
            {badgeViaje(vehiculo.estadoViaje)}
          </div>
          <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {formatFecha(vehiculo.fechaEstado)}
          </p>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Armchair className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-semibold text-white">Mapa de asientos</h3>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-600/30 border border-amber-600/30"></span> Chofer
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gray-700/50 border border-gray-700"></span> Bloqueado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gray-800 border border-gray-700"></span> Disponible
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-sky-600"></span> Seleccionado
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-600/30 border border-red-600/20"></span> Ocupado
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-1.5 max-w-xs mx-auto">
          <div className="bg-gray-700 rounded-t-xl w-full py-1.5 text-center text-[10px] text-gray-400 font-medium tracking-widest">
            FRENTE
          </div>
          {filasAsientos.map((fila, fi) => (
            <div key={fi} className="flex justify-center gap-1.5">
              {fila.map((num) => {
                const asiento = vehiculo.mapaAsientos.find((a) => a.numero === num);
                if (!asiento) return null;
                const tipo = tipoEstado(asiento);
                const esChofer = tipo === "chofer";
                const clickeable = tipo === "ocupado";
                return (
                  <button
                    key={num}
                    onClick={() => clickeable && setAsientoSeleccionado(asiento)}
                    disabled={!clickeable}
                    title={tipo === "ocupado" ? "Toca para ver el pasajero" : undefined}
                    className={`w-12 h-12 rounded-lg text-xs font-medium transition-all cursor-pointer flex flex-col items-center justify-center ${
                      claseSeleccionado(tipo, asiento.numero === ocupadoSeleccionadoNumero)
                    } ${clickeable ? "hover:ring-2 hover:ring-red-400/40" : ""}`}
                  >
                    <span className="text-[10px] leading-none">{num}</span>
                    {esChofer && <span className="text-[7px] leading-none mt-0.5">CHOFER</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          Toca un asiento ocupado para ver la informacion del pasajero.
        </p>
      </div>

      {asientoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-sky-400/10 flex items-center justify-center shrink-0">
                <UserIcon className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Asiento {asientoSeleccionado.numero}</h3>
                <p className="text-sm text-gray-400 mt-0.5">Placa: {vehiculo.placa}</p>
              </div>
              <button onClick={() => setAsientoSeleccionado(null)} className="ml-auto text-gray-500 hover:text-white cursor-pointer" title="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Pasajero</p>
                <p className="text-white font-medium mt-0.5">{asientoSeleccionado.pasajero || "—"}</p>
              </div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Asiento</p>
                <p className="text-white font-medium mt-0.5">#{asientoSeleccionado.numero}</p>
              </div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Estado del pasaje</p>
                <p className="text-white font-medium mt-0.5">
                  {estadoPasajeLabel(asientoSeleccionado.estadoPasaje) || "—"}
                </p>
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <button
                onClick={() => setAsientoSeleccionado(null)}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium transition-colors cursor-pointer"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {vehiculo.qrImagenUrl && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <QrCode className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-semibold text-white">Codigo QR del vehiculo</h3>
          </div>
          <div className="flex justify-center">
            <img src={vehiculo.qrImagenUrl} alt="QR del vehiculo" className="w-48 h-48 object-contain bg-white p-2 rounded-xl" />
          </div>
        </div>
      )}

      <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-4">
        <p className="text-sm text-gray-500 text-center">
          No puede modificar la placa ni los datos principales del vehiculo. Contacte a Secretaria para cambios.
        </p>
      </div>
    </div>
  );
}
