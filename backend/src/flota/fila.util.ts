import { Repository } from 'typeorm';
import { Vehiculo } from './vehiculo.entity';

// Estados de viaje que NO ocupan un puesto numerado dentro de la fila de la
// parada. Un vehículo "por salir" ya no es parte de la enumeración (se muestra
// aparte con su cuenta regresiva), y nunca se numeran los que están en ruta o
// en mantenimiento.
export const ESTADOS_EXCLUIDOS_DE_FILA = ['por_salir', 'en_ruta', 'mantenimiento'];

// Orden estable de la fila de una parada: primero el puestoFila persistido y,
// como desempate, el id (orden de registro). Es el MISMO orden en el que se
// reindexa la fila, de modo que la numeración siempre sea consecutiva.
function ordenarFila<T extends { id: number; puestoFila: number }>(fila: T[]): T[] {
  return [...fila].sort(
    (a, b) => (a.puestoFila || 0) - (b.puestoFila || 0) || (a.id || 0) - (b.id || 0),
  );
}

// Calcula EN MEMORIA la posición REAL de cada vehículo de una parada, con el
// MISMO criterio y orden que reindexarFilaOficial:
//   - solo choferes OFICIALES (cuenta rol=chofer ACTIVA con placa asignada)
//   - excluyendo por_salir / en_ruta / mantenimiento
//   - SOLO los que están ANOTADOS en la fila (puestoFila > 0). Un vehículo que
//     está ubicado en una parada pero con puestoFila = 0 NO ocupa un puesto:
//     "estar en la parada" (ubicación/sector) es distinto de "estar anotado en
//     la fila" (ocupar un puesto numerado).
// Devuelve un mapa placa -> puesto consecutivo 1..N. NO escribe en PostgreSQL.
// Un vehículo que no califica para ocupar puesto queda fuera del mapa.
export interface VehiculoPosicionable {
  placa: string;
  id: number;
  paradaActual: string;
  estadoViaje: string;
  puestoFila: number;
}

export function calcularPuestosFila<T extends VehiculoPosicionable>(
  lista: T[],
  parada: string,
  placasOficiales: Set<string>,
): Map<string, number> {
  const puestos = new Map<string, number>();
  const fila = ordenarFila(
    lista.filter((v) => v.paradaActual === parada && (v.puestoFila || 0) > 0),
  );

  let puesto = 1;
  for (const v of fila) {
    const esOficial = placasOficiales.has(v.placa);
    const esNombreable =
      esOficial && !ESTADOS_EXCLUIDOS_DE_FILA.includes(v.estadoViaje);
    if (esNombreable) {
      puestos.set(v.placa, puesto);
      puesto += 1;
    }
  }
  return puestos;
}

// Reindexa la fila de una parada para que los puestos queden CONSECUTIVOS y
// SIN huecos, numerando únicamente a los vehículos OFICIALES (chofer con
// cuenta rol=chofer activa y placa asignada) cuyo estadoViaje no es
// por_salir/en_ruta/mantenimiento y que YA están ANOTADOS (puestoFila > 0).
// Un vehículo ubicado en la parada pero con puestoFila = 0 (no anotado) NO
// ocupa puesto y conserva su puestoFila = 0.
export async function reindexarFilaOficial(
  repo: Repository<Vehiculo>,
  parada: string,
  placasOficiales: Set<string>,
): Promise<void> {
  const fila = await repo.find({
    where: { paradaActual: parada },
    order: { puestoFila: 'ASC', id: 'ASC' },
  });

  const puestos = calcularPuestosFila(fila, parada, placasOficiales);

  for (const v of fila) {
    const esAnotado = (v.puestoFila || 0) > 0;
    const puestoEsperado = esAnotado ? (puestos.get(v.placa) ?? 0) : 0;
    if (v.puestoFila !== puestoEsperado) {
      v.puestoFila = puestoEsperado;
      await repo.save(v);
    }
  }
}

// Calcula el siguiente puesto disponible para anotarse en una parada,
// considerando solo los vehículos oficiales que actualmente ocupan un puesto.
export async function obtenerSiguientePuesto(
  repo: Repository<Vehiculo>,
  parada: string,
  placasOficiales: Set<string>,
): Promise<number> {
  const fila = await repo.find({
    where: { paradaActual: parada },
    order: { puestoFila: 'ASC', id: 'ASC' },
  });

  const puestos = fila
    .filter(
      (v) =>
        (v.puestoFila || 0) > 0 &&
        placasOficiales.has(v.placa) &&
        !ESTADOS_EXCLUIDOS_DE_FILA.includes(v.estadoViaje),
    )
    .map((v) => v.puestoFila || 0);

  return puestos.length > 0 ? Math.max(...puestos) + 1 : 1;
}