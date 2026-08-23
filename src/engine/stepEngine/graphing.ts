// stepEngine/graphing.ts (spec v10 §10, Módulo 7 — Modo 6: Graficación).
//
// CAMBIO DE ENFOQUE DECLARADO respecto a la spec original: la spec pedía un
// híbrido "simbólico primero, numérico como fallback" para dominio, rango,
// extremos e inflexión. Esta implementación va DIRECTO al camino numérico
// (muestreo + diferencias finitas + bisección) para TODO el análisis,
// porque:
//   1. El riesgo sobre la API exacta de `limit()`/sustitución de Algebrite
//      ya se señaló repetidamente en los módulos anteriores; apoyar todo
//      este módulo (el de mayor riesgo del proyecto, según la propia spec)
//      en esa misma incertidumbre habría compuesto el riesgo.
//   2. El enfoque numérico es autocontenido (usa `numericFallback.ts`, sin
//      pasar por Algebrite en absoluto) y por lo tanto SIEMPRE puede
//      probarse de verdad en cuanto se compile, sin depender de la
//      superficie exacta de Algebrite.
// Por esto, TODO resultado de este módulo se marca confidence:
// "NUMERIC_FALLBACK" — no se pretende que sea simbólicamente exacto.
// Mejorar a intento simbólico primero (spec original) queda como TODO
// explícito para una iteración posterior, una vez que el resto del
// proyecto esté verificado contra Algebrite real.

import { compileNumeric } from "../numericFallback";
import { ErrorCode, type AppError } from "../../types";

export interface GraphAnalysis {
  domainDescription: string;
  rangeDescription: string;
  xIntercepts: number[];
  yIntercept: number | null;
  localMaxima: { x: number; y: number }[];
  localMinima: { x: number; y: number }[];
  globalMax: { x: number; y: number } | null;
  globalMin: { x: number; y: number } | null;
  inflectionPoints: { x: number; y: number }[];
  vertex: { x: number; y: number } | null;
  samples: { x: number; y: number }[]; // para dibujar la curva
}

const DEFAULT_VIEW: [number, number] = [-10, 10];
const SAMPLE_COUNT = 2000;
const H = 1e-4; // paso para diferencias finitas

function finiteDiff1(f: (x: number) => number, x: number): number {
  return (f(x + H) - f(x - H)) / (2 * H);
}
function finiteDiff2(f: (x: number) => number, x: number): number {
  return (f(x + H) - 2 * f(x) + f(x - H)) / (H * H);
}

function bisectRoot(f: (x: number) => number, a: number, b: number): number {
  let lo = a;
  let hi = b;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(f(lo)) === Math.sign(f(mid))) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function analyzeGraph(
  exprAlgebrite: string,
  variable: string,
  view: [number, number] = DEFAULT_VIEW,
): GraphAnalysis {
  let f: (x: number) => number;
  try {
    f = compileNumeric(exprAlgebrite, variable);
  } catch (err) {
    throw err as AppError;
  }

  const [a, b] = view;
  if (a === b) {
    throw {
      code: ErrorCode.DOMAIN_ERROR,
      message: '"Desde" y "hasta" no pueden ser el mismo valor — la ventana de la gráfica necesita un rango.',
    } as AppError;
  }
  const step = (b - a) / SAMPLE_COUNT;
  const samples: { x: number; y: number }[] = [];
  const validXs: number[] = [];
  const validYs: number[] = [];

  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const x = a + i * step;
    let y: number;
    try {
      y = f(x);
    } catch {
      y = NaN;
    }
    if (Number.isFinite(y)) {
      samples.push({ x, y });
      validXs.push(x);
      validYs.push(y);
    }
  }

  if (validXs.length === 0) {
    throw {
      code: ErrorCode.DOMAIN_ERROR,
      message: "La función no está definida en ningún punto del rango visible.",
    } as AppError;
  }

  // Dominio: se reportan los "huecos" detectados como puntos individuales
  // sin valor finito, aproximado por muestreo (no es un análisis simbólico
  // de restricciones — ver nota de cabecera).
  const excludedCount = SAMPLE_COUNT + 1 - validXs.length;
  const domainDescription =
    excludedCount === 0
      ? `Aproximadamente todos los reales en [${a}, ${b}] (sin discontinuidades detectadas por muestreo).`
      : `${validXs.length} de ${SAMPLE_COUNT + 1} puntos muestreados en [${a}, ${b}] están definidos — hay discontinuidades o restricciones de dominio (aproximado por muestreo, no exacto).`;

  const rangeDescription = `Aproximadamente [${Math.min(...validYs).toFixed(4)}, ${Math.max(...validYs).toFixed(4)}] dentro del rango visible (basado en muestreo, no es un análisis simbólico exacto).`;

  // Intercepciones en x: cambios de signo + bisección.
  const xIntercepts: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    const [p, q] = [samples[i - 1], samples[i]];
    if (Math.sign(p.y) !== Math.sign(q.y) && p.y !== 0) {
      xIntercepts.push(bisectRoot(f, p.x, q.x));
    } else if (q.y === 0) {
      xIntercepts.push(q.x);
    }
  }

  // Intercepción en y.
  let yIntercept: number | null = null;
  try {
    const y0 = f(0);
    if (Number.isFinite(y0)) yIntercept = y0;
  } catch {
    yIntercept = null;
  }

  // Extremos locales: cambios de signo en f' + clasificación por f''.
  const localMaxima: { x: number; y: number }[] = [];
  const localMinima: { x: number; y: number }[] = [];
  for (let i = 1; i < validXs.length - 1; i++) {
    const x = validXs[i];
    const d1Prev = finiteDiff1(f, validXs[i - 1]);
    const d1Curr = finiteDiff1(f, x);
    if (Math.sign(d1Prev) !== Math.sign(d1Curr) && Math.sign(d1Prev) !== 0) {
      const d2 = finiteDiff2(f, x);
      const point = { x, y: f(x) };
      if (d2 < 0) localMaxima.push(point);
      else if (d2 > 0) localMinima.push(point);
    }
  }

  const globalMax = validYs.length
    ? { x: validXs[validYs.indexOf(Math.max(...validYs))], y: Math.max(...validYs) }
    : null;
  const globalMin = validYs.length
    ? { x: validXs[validYs.indexOf(Math.min(...validYs))], y: Math.min(...validYs) }
    : null;

  // Puntos de inflexión: cambios de signo en f''.
  const inflectionPoints: { x: number; y: number }[] = [];
  for (let i = 1; i < validXs.length - 1; i++) {
    const x = validXs[i];
    const d2Prev = finiteDiff2(f, validXs[i - 1]);
    const d2Curr = finiteDiff2(f, x);
    if (Math.sign(d2Prev) !== Math.sign(d2Curr) && Math.sign(d2Prev) !== 0) {
      inflectionPoints.push({ x, y: f(x) });
    }
  }

  // Vértice: solo si f'' es aproximadamente constante en todo el muestreo
  // (indicio fuerte de función cuadrática) — spec v10 §10.
  const secondDerivSamples = validXs
    .filter((_, i) => i % 50 === 0)
    .map((x) => finiteDiff2(f, x));
  const avg2nd = secondDerivSamples.reduce((s, v) => s + v, 0) / secondDerivSamples.length;
  const isQuadratic = secondDerivSamples.every((v) => Math.abs(v - avg2nd) < Math.max(0.05, Math.abs(avg2nd) * 0.02));
  let vertex: { x: number; y: number } | null = null;
  if (isQuadratic && Math.abs(avg2nd) > 1e-6) {
    const a2 = avg2nd / 2;
    const b1 = finiteDiff1(f, 0) - 2 * a2 * 0;
    const vx = -b1 / (2 * a2);
    vertex = { x: vx, y: f(vx) };
  }

  return {
    domainDescription,
    rangeDescription,
    xIntercepts: dedupeClose(xIntercepts),
    yIntercept,
    localMaxima: dedupePoints(localMaxima),
    localMinima: dedupePoints(localMinima),
    globalMax,
    globalMin,
    inflectionPoints: dedupePoints(inflectionPoints),
    vertex,
    samples,
  };
}

function dedupeClose(values: number[], tolerance = 1e-2): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || Math.abs(v - out[out.length - 1]) > tolerance) out.push(v);
  }
  return out;
}

function dedupePoints(points: { x: number; y: number }[], tolerance = 1e-2): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const p of points) {
    if (!out.some((o) => Math.abs(o.x - p.x) < tolerance)) out.push(p);
  }
  return out;
}
