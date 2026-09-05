// Convierte un importe a number para operaciones matemáticas.
// - Acepta number y strings numéricos ("20.00").
// - null / undefined / "" se tratan como 0.
// - evita NaN.
// - NO modifica el valor original.
// - IMPORTANTE: sumar SIEMPRE con toMoneyNumber antes de formatear; nunca
//   concatenar strings ya formateados (fast error: "20.00" + "160.00").
export function toMoneyNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Formato visual consistente: Bs 20.00 (dos decimales, punto decimal).
// Usarlo SOLO para presentación, después de sumar como number.
export function formatBs(value: number | string | null | undefined): string {
  return "Bs " + toMoneyNumber(value).toFixed(2);
}