import { useEffect, useMemo, useState } from "react";
import { configurarAsientos, obtenerVehiculos } from "../../api/flota.api";
import type { Vehiculo } from "../../types/vehiculo";
import {
  normalizarConfiguracion,
  generarConfiguracionPorDefecto,
} from "../../utils/asientos-config";
import {
  Armchair,
  Eraser,
  UserRound,
  UserRoundCheck,
  Plus,
  Minus,
  RotateCcw,
  Rows3,
  Columns3,
  Save,
  X,
  AlertTriangle,
} from "lucide-react";

interface Props {
  // Modo persistido: vehículo ya existente (carga y guarda en la base de datos).
  vehiculoId?: number;
  // Modo borrador: se abre ANTES de registrar el chofer. La distribución se
  // guarda temporalmente vía onGuardarDraft y se persiste al registrar.
  capacidadInicial?: number;
  placaLibre?: string;
  // Distribución ya configurada (para re-editar en modo borrador).
  filasIniciales?: (number | null)[][];
  asientosChoferIniciales?: number[];
  onGuardarDraft?: (
    filas: (number | null)[][],
    asientosChofer: number[],
    capacidad: number,
  ) => void;
  onCerrado: () => void;
}

interface Celda {
  fila: number;
  columna: number;
}

export default function ConfiguradorAsientos({
  vehiculoId,
  capacidadInicial,
  placaLibre,
  filasIniciales,
  asientosChoferIniciales,
  onGuardarDraft,
  onCerrado,
}: Props) {
  const esDraft = !vehiculoId;
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);
  const [capacidadDraft, setCapacidadDraft] = useState<number>(() =>
    typeof capacidadInicial === "number" && capacidadInicial >= 4 ? capacidadInicial : 10,
  );
  const [grid, setGrid] = useState<(number | null)[][]>([]);
  const [asientosChofer, setAsientosChofer] = useState<number[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [seleccion, setSeleccion] = useState<Celda | null>(null);
  const [dragOrigen, setDragOrigen] = useState<Celda | null>(null);

  useEffect(() => {
    if (esDraft) {
      // Modo borrador: se inicializa con la capacidad indicada (2 primeros
      // asientos como chofer por defecto) o, si ya existe una distribución
      // configurada (re-edición), se restaura tal cual. NO se crea ningún
      // vehículo ni se persiste nada hasta guardar y registrar el chofer.
      if (filasIniciales && filasIniciales.length > 0) {
        setGrid(filasIniciales.map((f) => [...f]));
        setAsientosChofer(asientosChoferIniciales || []);
      } else {
        const cfg = generarConfiguracionPorDefecto(capacidadDraft);
        setGrid(cfg.filas.map((f) => [...f]));
        setAsientosChofer(capacidadDraft >= 2 ? [1, 2] : [1]);
      }
      return;
    }
    obtenerVehiculos()
      .then((lista: Vehiculo[]) => {
        const v = lista.find((item) => item.id === vehiculoId);
        if (!v) {
          setMensaje({ tipo: "error", texto: "No se pudo cargar el vehículo." });
          return;
        }
        setVehiculo(v);
        const cfg = normalizarConfiguracion(v.configuracionAsientos, v.capacidadTotal || 14);
        setGrid(cfg.filas.map((f) => [...f]));
        setAsientosChofer(
          v.asientosChofer && v.asientosChofer.length > 0 ? v.asientosChofer : [],
        );
      })
      .catch(() => setMensaje({ tipo: "error", texto: "No se pudo cargar el vehículo." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculoId, esDraft, capacidadInicial, filasIniciales, asientosChoferIniciales]);

  const capacidad = esDraft ? Math.max(4, capacidadDraft) : (vehiculo?.capacidadTotal || 14);
  const ocupados = new Set(vehiculo?.asientosOcupados || []);
  const maxAncho = Math.max(...grid.map((f) => f.length), 0);

  // Modo borrador: permite indicar cuántos asientos tendrá el vehículo. Al
  // cambiar la capacidad se regenera la cuadrícula con esa cantidad inicial.
  function cambiarCapacidadDraft(n: number) {
    const cap = Math.max(4, Math.floor(n) || 4);
    setCapacidadDraft(cap);
    const cfg = generarConfiguracionPorDefecto(cap);
    setGrid(cfg.filas.map((f) => [...f]));
    setAsientosChofer(cap >= 2 ? [1, 2] : [1]);
    setSeleccion(null);
    setMensaje(null);
  }

  const numeros = useMemo(
    () =>
      grid
        .flat()
        .filter((c): c is number => typeof c === "number"),
    [grid],
  );

  function numeroLibre(): number | null {
    for (let n = 1; n <= capacidad; n++) {
      if (!numeros.includes(n)) return n;
    }
    return null;
  }

  function valor(fila: number, columna: number): number | null {
    return grid[fila]?.[columna] ?? null;
  }

  function esChofer(n: number): boolean {
    return asientosChofer.includes(n);
  }

  function cellEstado(fila: number, columna: number): "espacio" | "chofer" | "ocupado" | "libre" {
    const n = valor(fila, columna);
    if (n === null) return "espacio";
    if (esChofer(n)) return "chofer";
    if (ocupados.has(n)) return "ocupado";
    return "libre";
  }

  function setValor(fila: number, columna: number, val: number | null) {
    setGrid((prev) => {
      const copia = prev.map((f) => [...f]);
      copia[fila][columna] = val;
      return copia;
    });
  }

  function agregarFila() {
    setGrid((prev) => {
      const ancho = prev[0]?.length || 0;
      return [...prev, Array(ancho).fill(null)];
    });
    setMensaje(null);
  }

  function agregarColumna() {
    setGrid((prev) =>
      prev.map((fila) => [...fila, null]),
    );
    setMensaje(null);
  }

  function quitarFila() {
    if (grid.length <= 1) {
      setMensaje({ tipo: "error", texto: "Debe existir al menos una fila." });
      return;
    }
    const ultimaFila = grid[grid.length - 1];
    const asientosFila = ultimaFila.filter(
      (n): n is number => typeof n === "number",
    );
    if (asientosFila.some((n) => ocupados.has(n))) {
      setMensaje({
        tipo: "error",
        texto: "Esta fila contiene asientos con pasajeros asignados y no puede eliminarse.",
      });
      return;
    }
    if (asientosFila.length > 0) {
      const choferesFila = asientosFila.filter((n) => asientosChofer.includes(n));
      const mensaje =
        choferesFila.length > 0
          ? "Esta fila contiene asientos asignados al chofer. ¿Desea eliminarla?"
          : "¿Desea quitar esta fila?";
      if (!confirm(mensaje)) {
        setMensaje(null);
        return;
      }
      if (choferesFila.length > 0) {
        setAsientosChofer((prev) => prev.filter((a) => !choferesFila.includes(a)));
      }
    }
    setGrid((prev) => prev.slice(0, -1));
    setSeleccion(null);
    setMensaje(null);
  }

  function quitarColumna() {
    if (maxAncho <= 1) {
      setMensaje({ tipo: "error", texto: "Debe existir al menos una columna." });
      return;
    }
    const col = maxAncho - 1;
    const asientosCol = grid
      .map((f) => f[col] ?? null)
      .filter((n): n is number => typeof n === "number");
    if (asientosCol.some((n) => ocupados.has(n))) {
      setMensaje({
        tipo: "error",
        texto: "Esta columna contiene asientos con pasajeros asignados y no puede eliminarse.",
      });
      return;
    }
    if (asientosCol.length > 0) {
      const choferesCol = asientosCol.filter((n) => asientosChofer.includes(n));
      const mensaje =
        choferesCol.length > 0
          ? "Esta columna contiene asientos asignados al chofer. ¿Desea eliminarla?"
          : "¿Desea quitar esta columna?";
      if (!confirm(mensaje)) {
        setMensaje(null);
        return;
      }
      if (choferesCol.length > 0) {
        setAsientosChofer((prev) => prev.filter((a) => !choferesCol.includes(a)));
      }
    }
    setGrid((prev) => prev.map((fila) => fila.slice(0, -1)));
    if (seleccion && seleccion.columna >= col) setSeleccion(null);
    setMensaje(null);
  }

  // Añadir asiento en una celda vacía (espacio) con el siguiente número libre.
  function agregarAsiento(fila: number, columna: number) {
    if (valor(fila, columna) !== null) return;
    const nuevo = numeroLibre();
    if (nuevo === null) {
      setMensaje({
        tipo: "error",
        texto: `No hay más números disponibles (capacidad máxima ${capacidad}).`,
      });
      return;
    }
    setValor(fila, columna, nuevo);
    setSeleccion({ fila, columna });
    setMensaje(null);
  }

  // Eliminar asiento: lo convierte en espacio vacío.
  function eliminarAsiento(fila: number, columna: number) {
    const n = valor(fila, columna);
    if (n === null) return;
    if (esChofer(n)) {
      setMensaje({ tipo: "error", texto: `Marque primero el asiento ${n} como no-chofer para poder eliminarlo.` });
      return;
    }
    if (ocupados.has(n)) {
      setMensaje({ tipo: "error", texto: `El asiento ${n} tiene una venta activa y no puede eliminarse.` });
      return;
    }
    setValor(fila, columna, null);
    setMensaje(null);
  }

  function marcarChofer(fila: number, columna: number) {
    const n = valor(fila, columna);
    if (n === null) return;
    if (ocupados.has(n)) {
      setMensaje({ tipo: "error", texto: `El asiento ${n} tiene una venta activa y no puede asignarse al chofer.` });
      return;
    }
    if (!asientosChofer.includes(n)) {
      setAsientosChofer((prev) => [...prev, n].sort((a, b) => a - b));
    }
    setMensaje(null);
  }

  function quitarChofer(fila: number, columna: number) {
    const n = valor(fila, columna);
    if (n === null) return;
    setAsientosChofer((prev) => prev.filter((a) => a !== n));
    setMensaje(null);
  }

  // Drag & drop: mover un asiento a otra celda (intercambia o rellena espacio).
  function soltarEn(origen: Celda, destino: Celda) {
    const a = valor(origen.fila, origen.columna);
    const b = valor(destino.fila, destino.columna);
    setGrid((prev) => {
      const copia = prev.map((f) => [...f]);
      copia[destino.fila][destino.columna] = a;
      copia[origen.fila][origen.columna] = b === null ? null : b;
      return copia;
    });
    setSeleccion(null);
    setDragOrigen(null);
    setMensaje(null);
  }

  function restablecer() {
    setGrid(
      Array.from({ length: Math.ceil(capacidad / 3) }, (_, i) =>
        [i * 3 + 1, i * 3 + 2, i * 3 + 3].filter((n) => n <= capacidad),
      ),
    );
    setAsientosChofer(capacidad >= 2 ? [1, 2] : [1]);
    setSeleccion(null);
    setMensaje(null);
  }

  async function guardar() {
    if (!esDraft && !vehiculo) return;
    if (asientosChofer.length < 1) {
      setMensaje({ tipo: "error", texto: "Debe marcar al menos 1 asiento como chofer." });
      return;
    }
    if (numeros.length - asientosChofer.length < 1) {
      setMensaje({ tipo: "error", texto: "Debe quedar al menos 1 asiento para pasajeros." });
      return;
    }
    const maxAncho = Math.max(...grid.map((f) => f.length), 0);
    const filasNorm = grid.map((fila) =>
      Array.from({ length: maxAncho }, (_, i) => fila[i] ?? null),
    );

    if (esDraft) {
      // Modo borrador: no persiste en PostgreSQL. Entrega la distribución
      // configurada al formulario para que se guarde al registrar el chofer.
      if (onGuardarDraft) onGuardarDraft(filasNorm, [...asientosChofer].sort((a, b) => a - b), capacidad);
      setMensaje({ tipo: "ok", texto: "Distribución configurada correctamente." });
      setTimeout(onCerrado, 600);
      return;
    }

    setGuardando(true);
    setMensaje(null);
    try {
      await configurarAsientos(vehiculo!.id!, filasNorm, asientosChofer);
      setMensaje({ tipo: "ok", texto: "Distribución de asientos guardada correctamente." });
      setTimeout(onCerrado, 900);
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setMensaje({ tipo: "error", texto: Array.isArray(msg) ? msg.join(", ") : (msg || "Error al guardar la configuración.") });
    } finally {
      setGuardando(false);
    }
  }

  if (!esDraft && !vehiculo) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={onCerrado} />
        <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md text-center text-gray-400">
          Cargando vehículo...
        </div>
      </div>
    );
  }

  const seleccionEstado = seleccion ? cellEstado(seleccion.fila, seleccion.columna) : null;

  const classDocel = "w-12 h-12 rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center gap-0.5 select-none";

  function claseCelda(fila: number, columna: number) {
    const estado = cellEstado(fila, columna);
    const sel = seleccion?.fila === fila && seleccion?.columna === columna;
    if (estado === "espacio")
      return "bg-gray-900/30 border border-dashed border-gray-700";
    if (estado === "chofer")
      return sel
        ? "bg-sky-600 text-white ring-2 ring-sky-300 border-sky-500 cursor-pointer"
        : "bg-amber-600/20 text-amber-400 border border-amber-600/40 cursor-grab";
    if (estado === "ocupado")
      return "bg-red-600/20 text-red-400 border border-red-600/30 opacity-70";
    return sel
      ? "bg-sky-600 text-white ring-2 ring-sky-300 border-sky-500 cursor-pointer"
      : "bg-gray-800 text-white border border-gray-700 cursor-grab hover:bg-gray-700";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCerrado} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold text-white">Diseñador de asientos - {vehiculo?.placa || placaLibre || "Nuevo vehículo"}</h3>
            {esDraft ? (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs text-gray-400">Capacidad del vehículo:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => cambiarCapacidadDraft(capacidad - 1)}
                    className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-md cursor-pointer text-sm"
                    title="Reducir capacidad"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={4}
                    value={capacidad}
                    onChange={(e) => cambiarCapacidadDraft(Number(e.target.value))}
                    className="w-16 text-center bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => cambiarCapacidadDraft(capacidad + 1)}
                    className="w-7 h-7 flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-md cursor-pointer text-sm"
                    title="Aumentar capacidad"
                  >
                    +
                  </button>
                </div>
                <span className="text-[11px] text-amber-400/80">
                  Al cambiar la capacidad se regenera la cuadrícula.
                </span>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">
                Capacidad {capacidad} · Asientos definidos {numeros.length} · Chofer {asientosChofer.length} · Arrastra los asientos para reubicarlos.
              </p>
            )}
          </div>
          <button onClick={onCerrado} className="text-gray-500 hover:text-white cursor-pointer" title="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
          <div>
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-5 flex flex-col items-center gap-1.5">
              <div className="bg-gray-700 rounded-t-xl w-full py-1.5 text-center text-[10px] text-gray-400 font-medium tracking-widest">
                FRENTE
              </div>
              <div className="flex flex-col gap-1.5 items-center">
                {grid.map((fila, fi) => (
                  <div
                    key={fi}
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${maxAncho || 1}, 3rem)`,
                      gap: "0.375rem",
                    }}
                  >
                    {Array.from({ length: maxAncho }, (_, ci) => {
                      const numero = fila[ci] ?? null;
                      const estado = cellEstado(fi, ci);
                      const esSeleccion = seleccion?.fila === fi && seleccion?.columna === ci;
                      return (
                        <div
                          key={ci}
                          draggable={estado !== "espacio" && !esSeleccion}
                          onDragStart={() => setDragOrigen({ fila: fi, columna: ci })}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (dragOrigen && (dragOrigen.fila !== fi || dragOrigen.columna !== ci)) {
                              soltarEn(dragOrigen, { fila: fi, columna: ci });
                            } else {
                              setDragOrigen(null);
                            }
                          }}
                          onClick={() =>
                            estado === "espacio"
                              ? numero === null && agregarAsiento(fi, ci)
                              : setSeleccion({ fila: fi, columna: ci })
                          }
                          className={`${classDocel} ${claseCelda(fi, ci)}`}
                          title={estado === "espacio" ? "Clic para agregar asiento aquí" : `Asiento ${numero}`}
                        >
                          {estado === "espacio" ? (
                            <Plus className="w-4 h-4 text-gray-600" />
                          ) : (
                            <>
                              <span className="leading-none">{numero}</span>
                              {estado === "chofer" && (
                                <span className="text-[7px] leading-none">CHOFER</span>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <button onClick={agregarFila} className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs cursor-pointer">
                  <Rows3 className="w-3.5 h-3.5" /> Agregar fila
                </button>
                <button onClick={quitarFila} className="flex items-center gap-1 bg-red-600/15 hover:bg-red-600/25 text-red-400 px-3 py-1.5 rounded-lg text-xs cursor-pointer">
                  <Minus className="w-3.5 h-3.5" /> Quitar fila
                </button>
                <button onClick={agregarColumna} className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs cursor-pointer">
                  <Columns3 className="w-3.5 h-3.5" /> Agregar columna
                </button>
                <button onClick={quitarColumna} className="flex items-center gap-1 bg-red-600/15 hover:bg-red-600/25 text-red-400 px-3 py-1.5 rounded-lg text-xs cursor-pointer">
                  <Minus className="w-3.5 h-3.5" /> Quitar columna
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:w-64">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Seleccion</p>
              {seleccionEstado === null ? (
                <p className="text-sm text-gray-500">Haz clic en un asiento o en un espacio para editarlo.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-white">
                    {seleccionEstado === "espacio"
                      ? "Espacio vacío"
                      : `Asiento ${valor(seleccion!.fila, seleccion!.columna)} · ${seleccionEstado}`}
                  </p>
                  {seleccionEstado === "espacio" && (
                    <button
                      onClick={() => {
                        if (seleccion) agregarAsiento(seleccion.fila, seleccion.columna);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white py-2 rounded-lg text-sm cursor-pointer"
                    >
                      <Armchair className="w-4 h-4" /> Agregar asiento aquí
                    </button>
                  )}
                  {seleccionEstado !== "espacio" && seleccionEstado !== "ocupado" && (
                    <>
                      {seleccionEstado === "chofer" ? (
                        <button
                          onClick={() => {
                            if (seleccion) quitarChofer(seleccion.fila, seleccion.columna);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm cursor-pointer"
                        >
                          <UserRound className="w-4 h-4" /> Quitar chofer
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (seleccion) marcarChofer(seleccion.fila, seleccion.columna);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 bg-amber-600/80 hover:bg-amber-600 text-white py-2 rounded-lg text-sm cursor-pointer"
                        >
                          <UserRoundCheck className="w-4 h-4" /> Marcar como chofer
                        </button>
                      )}
                      {seleccionEstado === "libre" && (
                        <button
                          onClick={() => {
                            if (seleccion) eliminarAsiento(seleccion.fila, seleccion.columna);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 bg-red-600/80 hover:bg-red-600 text-white py-2 rounded-lg text-sm cursor-pointer"
                        >
                          <Eraser className="w-4 h-4" /> Eliminar asiento (espacio)
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {mensaje && (
              <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${mensaje.tipo === "error" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{mensaje.texto}</span>
              </div>
            )}

            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-4 text-xs text-gray-400 space-y-1.5">
              <p className="uppercase tracking-wider text-gray-500">Leyenda</p>
              <p className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-amber-600/20 border border-amber-600/40 inline-block" /> Chofer</p>
              <p className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-gray-800 border border-gray-700 inline-block" /> Libre (asiento)</p>
              <p className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-red-600/20 border border-red-600/30 inline-block" /> Ocupado (vendido)</p>
              <p className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-gray-900/30 border border-dashed border-gray-700 inline-block" /> Espacio vacío</p>
              <p className="flex items-center gap-1.5 text-[11px] text-gray-500">Asientos vendibles: {numeros.length - asientosChofer.length} · Vacíos: {grid.flat().filter((c) => c === null).length}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button
            onClick={restablecer}
            className="flex items-center gap-1 px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Restablecer
          </button>
          <button
            onClick={onCerrado}
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" /> {guardando ? "Guardando..." : "Guardar distribución"}
          </button>
        </div>
      </div>
    </div>
  );
}
