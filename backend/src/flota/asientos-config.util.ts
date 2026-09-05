// Utilidad compartida para la configuración oficial de asientos de un vehículo.
// Estructura oficial: { ancho: number; filas: (number | null)[][] }
// null = espacio vacío (no vendible). Un número = asiento (numeración libre/única).

export interface ConfiguracionAsientos {
  ancho: number;
  filas: (number | null)[][];
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

export function normalizarConfiguracionAsientos(
  config: {
    ancho?: number;
    filas?: (number | null)[][];
  } | null | undefined,
  capacidadTotal: number,
): ConfiguracionAsientos {
  if (config && Array.isArray(config.filas) && config.filas.length > 0) {
    const filas = config.filas.map((fila) =>
      Array.isArray(fila) ? [...fila] : [],
    );
    const ancho =
      typeof config.ancho === 'number' && config.ancho > 0
        ? config.ancho
        : Math.max(...filas.map((f) => f.length), 0);
    return { ancho, filas };
  }
  return generarConfiguracionPorDefecto(capacidadTotal);
}

export function obtenerAsientosDistribuidos(
  config: ConfiguracionAsientos,
): number[] {
  return config.filas
    .flat()
    .filter((c): c is number => typeof c === 'number');
}
