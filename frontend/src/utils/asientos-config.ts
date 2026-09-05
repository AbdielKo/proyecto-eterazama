// Configuración oficial de asientos por vehículo.
// Estructura: { ancho: number; filas: (number | null)[][] }
// null = espacio vacío (no vendible). Un número = asiento (numeración única).

export interface ConfiguracionAsientos {
  ancho: number;
  filas: (number | null)[][];
}

export type EstadoAsiento =
  | "chofer"
  | "libre"
  | "ocupado"
  | "espacio";

export interface CeldaAsiento {
  numero: number | null;
  fila: number;
  columna: number;
  estado: EstadoAsiento;
  esChofer: boolean;
}

export function generarConfiguracionPorDefecto(
  capacidadTotal: number,
): ConfiguracionAsientos {
  const filas: (number | null)[][] = [];
  for (let i = 1; i <= capacidadTotal; i += 3) {
    filas.push([i, i + 1, i + 2].filter((n) => n <= capacidadTotal));
  }
  const ancho = Math.max(...filas.map((f) => f.length), 0);
  return { ancho, filas };
}

export function normalizarConfiguracion(
  config: ConfiguracionAsientos | { filas: (number | null)[][] } | null | undefined,
  capacidadTotal: number,
): ConfiguracionAsientos {
  const c = (config as ConfiguracionAsientos | null | undefined) ?? null;
  if (c && Array.isArray(c.filas) && c.filas.length > 0) {
    const filas = c.filas.map((f) => (Array.isArray(f) ? [...f] : []));
    const ancho =
      typeof c.ancho === "number" && c.ancho > 0
        ? c.ancho
        : Math.max(...filas.map((f) => f.length), 0);
    return { ancho, filas };
  }
  return generarConfiguracionPorDefecto(capacidadTotal);
}

// Devuelve una MATRIZ rectangular (cadena de celdas por fila) de ancho
// uniforme = config.ancho (o el máximo largo entre filas). Cada celda se
// coloca por su índice de columna, de modo que las columnas quedan
// perfectamente alineadas y los espacios vacíos ocupan una celda real.
export function resolverMatriz(
  config: ConfiguracionAsientos,
  asientosChofer: number[],
  asientosOcupados: number[],
): CeldaAsiento[][] {
  const chofer = asientosChofer || [];
  const ocupados = new Set(asientosOcupados || []);
  const ancho = Math.max(
    config.ancho || 0,
    ...config.filas.map((f) => f.length),
  );
  const matriz: CeldaAsiento[][] = [];
  config.filas.forEach((fila, fi) => {
    const filaMatriz: CeldaAsiento[] = [];
    for (let ci = 0; ci < ancho; ci++) {
      const numero = fila[ci] ?? null;
      if (numero === null) {
        filaMatriz.push({
          numero: null,
          fila: fi,
          columna: ci,
          estado: "espacio",
          esChofer: false,
        });
        continue;
      }
      const esChofer = chofer.includes(numero);
      const ocupado = ocupados.has(numero);
      filaMatriz.push({
        numero,
        fila: fi,
        columna: ci,
        estado: esChofer ? "chofer" : ocupado ? "ocupado" : "libre",
        esChofer,
      });
    }
    matriz.push(filaMatriz);
  });
  return matriz;
}

// Resuelve el estado de cada celda a partir de la config oficial y el estado
// de ventas del vehículo. Los asientos del chofer se marcan desde
// asientosChofer; los ocupados desde asientosOcupados.
export function resolverDistribucion(
  config: ConfiguracionAsientos,
  asientosChofer: number[],
  asientosOcupados: number[],
): CeldaAsiento[] {
  const chofer = asientosChofer || [];
  const ocupados = new Set(asientosOcupados || []);
  const celdas: CeldaAsiento[] = [];
  config.filas.forEach((fila, fi) => {
    fila.forEach((numero, ci) => {
      if (numero === null) {
        celdas.push({
          numero: null,
          fila: fi,
          columna: ci,
          estado: "espacio",
          esChofer: false,
        });
        return;
      }
      const esChofer = chofer.includes(numero);
      const ocupado = ocupados.has(numero);
      celdas.push({
        numero,
        fila: fi,
        columna: ci,
        estado: esChofer ? "chofer" : ocupado ? "ocupado" : "libre",
        esChofer,
      });
    });
  });
  return celdas;
}

export function numeroAsientosVendibles(config: ConfiguracionAsientos): number {
  return config.filas
    .flat()
    .filter((c): c is number => typeof c === "number").length;
}
