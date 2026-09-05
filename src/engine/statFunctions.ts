// Fase 10 (hallazgo de la auditoría Fase 0 v2): mean/median/mode/stdev/
// variance/sort/mad/min/max NO son funciones nativas de Algebrite —
// confirmado probando el paquete real (Algebrite.run("mean(3,7,2)")
// devuelve "mean(3,7,2)" tal cual, sin evaluar ni fallar). A diferencia
// de nPr/nCr (Fase 3), no se pueden reescribir como una sola expresión
// simbólica porque reciben una cantidad variable de argumentos — se
// evalúan aquí numéricamente en JS. Cada argumento se resuelve primero
// con evaluate() de Algebrite (permite pasar expresiones, ej.
// "mean(2+2, sqrt(9))", no solo literales).
//
// Alcance de esta fase: la función de estadística debe ser la expresión
// COMPLETA (mismo alcance que el fallback numérico de asinh/acosh/atanh/
// sign de la Fase 3) — no se soporta todavía anidarla dentro de una
// expresión más grande, ej. "mean(1,2,3)+1".

import { evaluate } from "./algebriteClient";

export const STAT_FUNCTION_NAMES = [
  "mean",
  "median",
  "mode",
  "stdev",
  "variance",
  // Alias real: la tecla "variance" del teclado inserta \mathrm{var}, no
  // \mathrm{variance} (ver MathKeyboard.tsx) — se acepta también "var"
  // tal cual llega desde ahí.
  "var",
  "sort",
  "mad",
  "min",
  "max",
  "range",
  // P6 (spec v2 §7.1): variance/stdev de arriba son muestrales (n-1) —
  // faltaba la variante poblacional. Se agregan como funciones NUEVAS,
  // sin tocar variance/stdev/var (que ya usa el campo de expresión
  // libre) ni su firma.
  "variancePop",
  "stdevPop",
] as const;
export type StatFunctionName = (typeof STAT_FUNCTION_NAMES)[number];

function isStatFunctionName(name: string): name is StatFunctionName {
  return (STAT_FUNCTION_NAMES as readonly string[]).includes(name);
}

export function splitTopLevelArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of argsStr) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      args.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0 || args.length > 0) args.push(current);
  return args.map((a) => a.trim()).filter((a) => a.length > 0);
}

function evalNumericArg(arg: string): number {
  const raw = evaluate(arg);
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`No se pudo evaluar "${arg}" a un número.`);
  }
  return n;
}

// P6 (spec v2 §7.1): estos helpers se exportan (antes eran privados del
// módulo) para que StatisticsMode.tsx los reutilice directamente sobre
// arreglos numéricos ya parseados desde DataListInput — sin pasar por
// tryStatFunction()/evaluate(), que espera una expresión de texto tipo
// "mean(1,2,3)", no un arreglo. Mismo motivo que pide la spec:
// "reutilizar statFunctions.ts existente, no reimplementar".
export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function modes(values: number[]): number[] {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const maxCount = Math.max(...counts.values());
  return [...counts.entries()]
    .filter(([, c]) => c === maxCount)
    .map(([v]) => v)
    .sort((a, b) => a - b);
}

export function range(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

// Decisión DEDUCIBLE (no especificada antes): stdev/variance de MUESTRA
// (dividen entre n-1), la convención más común en calculadoras científicas
// (Casio fx, TI) para un conjunto de datos que no se asume la población
// completa. Documentado aquí para no dejarlo implícito.
export function variance(values: number[]): number {
  if (values.length < 2) {
    throw new Error("stdev/variance necesitan al menos 2 valores.");
  }
  const m = mean(values);
  const sumSq = values.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return sumSq / (values.length - 1);
}

export function stdev(values: number[]): number {
  return Math.sqrt(variance(values));
}

/** P6 (spec v2 §7.1): variante poblacional (divide entre n, no n-1) —
 * función nueva, variance()/stdev() de arriba no cambian. */
export function variancePopulation(values: number[]): number {
  if (values.length < 1) {
    throw new Error("stdevPop/variancePop necesitan al menos 1 valor.");
  }
  const m = mean(values);
  const sumSq = values.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return sumSq / values.length;
}

export function stdevPopulation(values: number[]): number {
  return Math.sqrt(variancePopulation(values));
}

export function mad(values: number[]): number {
  const m = mean(values);
  return mean(values.map((v) => Math.abs(v - m)));
}

/** Evita basura de flotantes tipo 2.0000000000000004. */
function formatNumber(n: number): string {
  return Number(n.toPrecision(12)).toString();
}

/**
 * Si `expr` ES un llamado a una de las funciones de estadística (la
 * expresión completa, ver alcance arriba), la evalúa aquí y devuelve el
 * resultado en sintaxis Algebrite. Devuelve null si no aplica, para que
 * el flujo normal siga su curso (incluye Algebrite fallando/tratándola
 * como símbolo desconocido, que es lo que pasaba antes de esta fase).
 */
export function tryStatFunction(expr: string): string | null {
  const match = expr.match(/^([a-zA-Z]+)\((.*)\)$/s);
  if (!match) return null;
  const [, name, argsStr] = match;
  if (!isStatFunctionName(name)) return null;

  const argStrings = splitTopLevelArgs(argsStr);
  if (argStrings.length === 0) {
    throw new Error(`${name}() necesita al menos un argumento.`);
  }

  if (name === "sort") {
    const values = argStrings.map(evalNumericArg).sort((a, b) => a - b);
    return `[${values.map(formatNumber).join(",")}]`;
  }

  const values = argStrings.map(evalNumericArg);

  switch (name) {
    case "mean":
      return formatNumber(mean(values));
    case "median":
      return formatNumber(median(values));
    case "mode": {
      const m = modes(values);
      return m.length === 1 ? formatNumber(m[0]) : `[${m.map(formatNumber).join(",")}]`;
    }
    case "min":
      return formatNumber(Math.min(...values));
    case "max":
      return formatNumber(Math.max(...values));
    case "range":
      return formatNumber(Math.max(...values) - Math.min(...values));
    case "stdev":
      return formatNumber(stdev(values));
    case "variance":
    case "var":
      return formatNumber(variance(values));
    case "stdevPop":
      return formatNumber(stdevPopulation(values));
    case "variancePop":
      return formatNumber(variancePopulation(values));
    case "mad":
      return formatNumber(mad(values));
    default:
      return null;
  }
}
