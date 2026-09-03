import { useEffect, useState } from "react";
import { obtenerVehiculos, trasladarVehiculo, eliminarVehiculo, actualizarVehiculo } from "../../api/flota.api";
import type { Vehiculo } from "../../types/vehiculo";
import FormVehiculo from "./FormVehiculo";
import { useFlotaSocket } from "../../hooks/useFlotaSocket";
import { MapPin, Trash2, ArrowRight, X, Search, ChevronDown, ChevronUp, Pencil, Save, Truck, Wrench } from "lucide-react";

export default function GestionFlota() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Vehiculo>>({});

  async function cargar() {
    try {
      const datos = await obtenerVehiculos();
      setVehiculos(datos);
    } catch (error) {
      console.error(error);
    }
  }

  useFlotaSocket(cargar);

  useEffect(() => { cargar(); }, []);

  async function mover(id: number, parada: string) {
    try {
      await trasladarVehiculo(id, parada);
      cargar();
    } catch (error) {
      console.error(error);
    }
  }

  async function eliminar(id: number) {
    if (!confirm("Seguro que desea eliminar este vehiculo?")) return;
    try {
      await eliminarVehiculo(id);
      cargar();
    } catch (error) {
      console.error(error);
    }
  }

  function iniciarEdicion(v: Vehiculo) {
    setEditandoId(v.id ?? null);
    setEditForm({ ...v });
  }

  async function guardarEdicion(id: number) {
    try {
      await actualizarVehiculo(id, editForm);
      setEditandoId(null);
      cargar();
    } catch (error) {
      console.error(error);
    }
  }

  const filtrados = vehiculos.filter(
    (v) =>
      v.placa?.toLowerCase().includes(busqueda.toLowerCase()) ||
      v.choferNombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
      v.choferCi?.includes(busqueda)
  );

  // El estado unico real se consulta desde la base de datos (estadoViaje).
  const enRuta = filtrados.filter((v) => v.estadoViaje === "en_ruta");
  const mantenimiento = filtrados.filter((v) => v.estadoViaje === "mantenimiento");

  // Los vehiculos en ruta o en mantenimiento no forman parte de la fila.
  const enFila = filtrados.filter(
    (v) => v.estadoViaje !== "en_ruta" && v.estadoViaje !== "mantenimiento"
  );
  const cochabamba = enFila.filter((v) => v.paradaActual === "cochabamba");
  const eterazama = enFila.filter((v) => v.paradaActual === "eterazama");
  const fuera = enFila.filter((v) => v.paradaActual === "fuera_de_fila");

  function badgeEstado(estado?: string) {
    if (!estado) return null;
    const colores: Record<string, string> = {
      en_ruta: "bg-sky-400/10 text-sky-400",
      fin_de_ruta: "bg-purple-400/10 text-purple-400",
      mantenimiento: "bg-amber-400/10 text-amber-400",
      inactivo: "bg-red-400/10 text-red-400",
      activo: "bg-emerald-400/10 text-emerald-400",
      listo: "bg-gray-400/10 text-gray-400",
    };
    const etiquetas: Record<string, string> = {
      en_ruta: "EN RUTA",
      fin_de_ruta: "FIN DE RUTA",
      mantenimiento: "MANTENIMIENTO",
      inactivo: "INACTIVO",
      activo: "ACTIVO",
      listo: "LISTO",
    };
    return (
      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${colores[estado] || "bg-gray-400/10 text-gray-400"}`}>
        {etiquetas[estado] || estado}
      </span>
    );
  }

  function renderSeccion(titulo: string, color: string, lista: Vehiculo[], destino: string) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className={`w-4 h-4 ${color}`} />
          <h2 className="text-sm font-semibold text-white">{titulo}</h2>
          <span className="ml-auto bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{lista.length}</span>
        </div>
        {lista.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">Sin vehiculos</p>
        ) : (
          <div className="space-y-2">
            {lista.map((v, index) => (
              <div key={v.id} className="bg-gray-800 border border-gray-700/50 rounded-xl p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">#{v.puestoFila ?? index + 1}</span>
                      <span className="font-semibold text-sky-400 text-sm">{v.placa}</span>
                      {badgeEstado((v as any).estadoViaje || (v as any).estadoVehiculo)}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{v.choferNombre} | {v.tipoVehiculo}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Parada: {v.paradaActual}</p>
                    <button
                      onClick={() => setDetalleId(detalleId === v.id ? null : v.id!)}
                      className="text-[10px] text-gray-500 hover:text-gray-300 mt-1 flex items-center gap-0.5 cursor-pointer"
                    >
                      Detalles {detalleId === v.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {detalleId === v.id && !editandoId && (
                      <div className="mt-2 bg-gray-900 rounded-lg p-2 text-[11px] text-gray-400 space-y-0.5">
                        <p><span className="text-gray-500">Color:</span> {v.color}</p>
                        <p><span className="text-gray-500">CI:</span> {v.choferCi}</p>
                        <p><span className="text-gray-500">Puesto:</span> #{v.puestoFila}</p>
                        <p><span className="text-gray-500">Estado viaje:</span> {(v as any).estadoViaje}</p>
                        <p><span className="text-gray-500">Capacidad:</span> {v.capacidadTotal} asientos</p>
                      </div>
                    )}
                    {editandoId === v.id && (
                      <div className="mt-2 bg-gray-900 rounded-lg p-2 space-y-1.5">
                        <input className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" placeholder="Chofer" value={editForm.choferNombre || ""} onChange={(e) => setEditForm({ ...editForm, choferNombre: e.target.value })} />
                        <input className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" placeholder="CI" value={editForm.choferCi || ""} onChange={(e) => setEditForm({ ...editForm, choferCi: e.target.value })} />
                        <input className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" placeholder="Tipo" value={editForm.tipoVehiculo || ""} onChange={(e) => setEditForm({ ...editForm, tipoVehiculo: e.target.value })} />
                        <input className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" placeholder="Color" value={editForm.color || ""} onChange={(e) => setEditForm({ ...editForm, color: e.target.value })} />
                        <input type="number" min={4} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" placeholder="Cantidad de asientos" value={editForm.capacidadTotal || ""} onChange={(e) => setEditForm({ ...editForm, capacidadTotal: Number(e.target.value) })} />
                        <select className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white" value={editForm.paradaActual || ""} onChange={(e) => setEditForm({ ...editForm, paradaActual: e.target.value })}>
                          <option value="cochabamba">Cochabamba</option>
                          <option value="eterazama">Eterazama</option>
                          <option value="fuera_de_fila">Fuera de fila</option>
                          <option value="en_ruta">En ruta</option>
                        </select>
                        <button onClick={() => v.id !== undefined && guardarEdicion(v.id)} className="w-full flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded px-2 py-1 text-xs cursor-pointer">
                          <Save className="w-3 h-3" /> Guardar
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => v.id !== undefined && mover(v.id, destino)} className="p-1.5 bg-sky-600/20 text-sky-400 rounded-lg hover:bg-sky-600/30 transition-colors cursor-pointer" title={`Enviar a ${destino}`}>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    {v.id !== undefined && (
                      <button onClick={() => iniciarEdicion(v)} className="p-1.5 bg-amber-600/20 text-amber-400 rounded-lg hover:bg-amber-600/30 transition-colors cursor-pointer" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={() => v.id !== undefined && eliminar(v.id)} className="p-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors cursor-pointer" title="Eliminar">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderEnRuta(lista: Vehiculo[]) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">En ruta</h2>
          <span className="ml-auto bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{lista.length}</span>
        </div>
        {lista.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">Sin vehiculos en ruta</p>
        ) : (
          <div className="space-y-2">
            {lista.map((v) => {
              const viajeActual = v.viajeActual;
              const ruta =
                viajeActual?.origen && viajeActual?.destino
                  ? `${viajeActual.origen} → ${viajeActual.destino}`
                  : null;
              return (
                <div key={v.id} className="bg-sky-600/10 border border-sky-500/30 rounded-xl p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🚐</span>
                      <span className="font-semibold text-sky-400 text-sm">{v.placa}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-400/10 text-sky-400 font-medium">EN RUTA</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-gray-500">Chofer: </span>
                      <span className="text-white capitalize">{v.choferNombre}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Ruta: </span>
                      <span className="text-white">{ruta || "—"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Hora de salida: </span>
                      <span className="text-white">
                        {viajeActual?.horaSalida ? viajeActual.horaSalida.slice(0, 5) : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Pasajeros: </span>
                      <span className="text-white">{v.pasajeros ?? (v.asientosOcupados || []).length}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Asientos libres: </span>
                      <span className="text-white">{v.asientosLibres ?? "—"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderMantenimiento(lista: Vehiculo[]) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Fuera de servicio / Mantenimiento</h2>
          <span className="ml-auto bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 rounded-full">{lista.length}</span>
        </div>
        {lista.length === 0 ? (
          <p className="text-gray-500 text-xs py-4 text-center">Sin vehiculos en mantenimiento</p>
        ) : (
          <div className="space-y-2">
            {lista.map((v) => (
              <div key={v.id} className="bg-amber-600/10 border border-amber-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-400 text-sm">{v.placa}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 font-medium">MANTENIMIENTO</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  <span className="text-gray-500">Chofer: </span>
                  <span className="text-white capitalize">{v.choferNombre}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestion de Flota</h1>
          <p className="text-gray-400 text-sm mt-0.5">{vehiculos.length} vehiculos registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por placa o chofer..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent w-56"
            />
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            {showForm ? <X className="w-4 h-4" /> : "+ Nuevo"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <FormVehiculo recargar={() => { cargar(); setShowForm(false); }} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {renderSeccion("Cochabamba", "text-emerald-400", cochabamba, "eterazama")}
        {renderSeccion("Eterazama", "text-amber-400", eterazama, "cochabamba")}
        {renderSeccion("Fuera de fila", "text-red-400", fuera, "cochabamba")}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderEnRuta(enRuta)}
        {renderMantenimiento(mantenimiento)}
      </div>
    </div>
  );
}
