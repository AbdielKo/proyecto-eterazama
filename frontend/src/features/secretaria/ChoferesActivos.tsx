import { useEffect, useState, useMemo } from "react";
import { obtenerChoferesActivos, type ChoferActivo } from "../../api/secretaria.api";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import {
  Activity,
  MapPin,
  Users,
  Route,
  LogIn,
  Car,
} from "lucide-react";

type Filtro =
  | "todos"
  | "cochabamba"
  | "eterazama"
  | "fuera"
  | "en_fila"
  | "en_ruta"
  | "mantenimiento"
  | "inactivo";

const filtros: { valor: Filtro; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "cochabamba", label: "Cochabamba" },
  { valor: "eterazama", label: "Eterazama" },
  { valor: "fuera", label: "Fuera de fila" },
  { valor: "en_fila", label: "En fila" },
  { valor: "en_ruta", label: "En ruta" },
  { valor: "mantenimiento", label: "Mantenimiento" },
  { valor: "inactivo", label: "Inactivos" },
];

function coincidenFiltro(c: ChoferActivo, filtro: Filtro): boolean {
  switch (filtro) {
    case "todos":
      return true;
    case "cochabamba":
      return c.ubicacion === "cochabamba";
    case "eterazama":
      return c.ubicacion === "eterazama";
    case "fuera":
      return c.estadoFila === "fuera";
    case "en_fila":
      return c.estadoFila === "en_fila_cochabamba" || c.estadoFila === "en_fila_eterazama";
    case "en_ruta":
      return c.estadoDelViaje === "en_ruta" || c.estadoDelViaje === "por_salir";
    case "mantenimiento":
      return c.estadoDelViaje === "mantenimiento";
    case "inactivo":
      return c.estadoServicio !== "activo" || c.estadoDelViaje === "inactivo";
    default:
      return true;
  }
}

const etiquetaEstadoViaje: Record<string, { label: string; color: string }> = {
  listo: { label: "EN ESPERA", color: "bg-gray-600/20 text-gray-300" },
  fin_de_ruta: { label: "FIN DE RUTA", color: "bg-purple-500/20 text-purple-300" },
  por_salir: { label: "POR SALIR", color: "bg-blue-500/20 text-blue-300" },
  en_ruta: { label: "EN RUTA", color: "bg-sky-500/20 text-sky-300" },
  mantenimiento: { label: "MANTENIMIENTO", color: "bg-amber-500/20 text-amber-300" },
  inactivo: { label: "INACTIVO", color: "bg-red-500/20 text-red-300" },
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${color}`}>
      {label}
    </span>
  );
}

export default function ChoferesActivos() {
  const [choferes, setChoferes] = useState<ChoferActivo[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [buscando, setBuscando] = useState(false);

  async function cargar() {
    try {
      setBuscando(true);
      const data = await obtenerChoferesActivos();
      setChoferes(data);
    } catch (error) {
      console.error(error);
    } finally {
      setBuscando(false);
    }
  }

  useFlotaSocket(cargar);
  useEffect(() => {
    cargar();
  }, []);

  const visibles = useMemo(
    () => choferes.filter((c) => coincidenFiltro(c, filtro)),
    [choferes, filtro]
  );

  function renderTarjeta(c: ChoferActivo) {
    const badge = etiquetaEstadoViaje[c.estadoDelViaje] || etiquetaEstadoViaje.listo;
    const enFila =
      c.estadoFila === "en_fila_cochabamba" || c.estadoFila === "en_fila_eterazama";
    const ubicacionLabel =
      c.ubicacion === "cochabamba"
        ? "Cochabamba"
        : c.ubicacion === "eterazama"
        ? "Eterazama"
        : "Fuera de fila";

    return (
      <div
        key={c.id}
        className="bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-sky-500/50 transition-colors"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-sky-400/10 flex items-center justify-center shrink-0">
            <Car className="w-4 h-4 text-sky-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{c.choferNombre}</p>
            <p className="text-xs text-gray-500">{c.placa || "Sin vehículo"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge label={badge.label} color={badge.color} />
          {c.estadoServicio === "activo" ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/20 text-emerald-300">
              ACTIVO
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-500/20 text-red-300">
              INACTIVO
            </span>
          )}
          {enFila && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-300">
              EN FILA #{c.puestoFila}
            </span>
          )}
        </div>

        <div className="space-y-1.5 text-xs text-gray-400">
          <p className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-gray-500" /> Ubicación: {ubicacionLabel}
          </p>
          <p className="flex items-center gap-1.5">
            <LogIn className="w-3.5 h-3.5 text-gray-500" />{" "}
            {enFila
              ? `Anotado en ${
                  c.estadoFila === "en_fila_cochabamba" ? "Cochabamba" : "Eterazama"
                }, puesto #${c.puestoFila}`
              : c.estadoFila === "ubicado"
              ? "Ubicado en el sector, sin anotar"
              : "No anotado en ninguna fila"}
          </p>
          <p className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-gray-500" /> Pasajeros actuales: {c.pasajeros}
          </p>
          {c.viajeActual && (
            <p className="flex items-center gap-1.5">
              <Route className="w-3.5 h-3.5 text-gray-500" /> {c.viajeActual.origen || "—"} →{" "}
              {c.viajeActual.destino || "—"}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Choferes activos</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Estado en tiempo real de los choferes oficiales (se actualiza por WebSocket)
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Activity className="w-4 h-4 text-sky-400" />
          <span>{buscando ? "Actualizando..." : "En vivo"}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.valor}
            onClick={() => setFiltro(f.valor)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              filtro === f.valor
                ? "bg-sky-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibles.map(renderTarjeta)}
      </div>

      {visibles.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center text-gray-500 text-sm">
          No hay choferes que coincidan con este filtro.
        </div>
      )}
    </div>
  );
}