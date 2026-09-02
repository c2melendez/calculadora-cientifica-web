// stepEngine/calculus.ts (spec v10 §7, Módulo 4 — Modo Cálculo).
//
// Enfoque híbrido explícito por operación:
// - Derivada: solo simbólica (Algebrite `d()`, función bien establecida).
//   Orden 1-3 (spec v10 §7 — reducido de v9 por prudencia ante Algebrite).
// - Límite: intenta simbólico (Algebrite `limit()`), si falla cae a
//   estimación numérica por acercamiento (numericFallback.ts) —
//   confidence: "NUMERIC_FALLBACK" en ese caso, visible en la UI.
// - Integral indefinida: solo simbólica — nunca se inventa un resultado
//   numérico para una integral indefinida (no tiene un único valor).
// - Integral definida: intenta symbolic (evaluar la indefinida en los
//   límites), si falla usa Simpson numérico — igual que límite, marcado.

import {
  derivative as symbolicDerivative,
  indefiniteIntegral,
  symbolicLimit,
  evaluate,
  ErrorCode,
} from "../algebriteClient";
import { compileNumeric, numericLimit, numericLimitAtInfinity, simpsonIntegral } from "../numericFallback";
import type { Step, AppError, ResultConfidence } from "../../types";

export interface CalculusResult {
  resultLatex: string;
  steps: Step[];
  confidence: ResultConfidence;
}

// Fase 3 (paridad con la pantalla única): el orden de derivada ya no
// tiene tope artificial — Algebrite acepta d(cuerpo,x,N) con N nativo,
// verificado contra el paquete real (ver algebriteClient.ts). El tope de
// 1-3 que tenía este archivo ("reducido de v9 por prudencia ante
// Algebrite") ya no aplica: la pantalla única (vía normalize.ts) acepta
// cualquier N escrito a mano en \frac{d^N}{dx^N}, así que CalculusMode.tsx
// (el formulario dedicado) no debería quedar más limitado que eso.
export function calcDerivative(exprAlgebrite: string, variable: string, order: number): CalculusResult {
  const result = symbolicDerivative(exprAlgebrite, variable, order);
  return {
    resultLatex: result,
    confidence: "SYMBOLIC",
    steps: [
      { id: "original", latex: exprAlgebrite, explanation: "Expresión original." },
      {
        id: "result",
        latex: `\\frac{d${order > 1 ? `^${order}` : ""}}{d${variable}${order > 1 ? `^${order}` : ""}} = ${result}`,
        explanation: `Derivada de orden ${order} calculada simbólicamente.`,
      },
    ],
  };
}

export type LimitDirection = "both" | "left" | "right";

// Fase 3 (paridad con la pantalla única): antes esta función solo probaba
// un punto finito. tryLimitFallback (compute.worker.ts) ya resuelve
// infinito/lateral para la notación natural en Básica — se porta acá el
// mismo criterio para que el formulario dedicado de Cálculo llegue a lo
// mismo, sin que el usuario tenga que "saber" que escribiendo la notación
// a mano en Básica consigue más que en el formulario pensado para eso.
export function calcLimit(
  exprAlgebrite: string,
  variable: string,
  pointAlgebrite: string,
  pointNumeric: number,
  direction: LimitDirection = "both",
): CalculusResult {
  const isInfinite = pointAlgebrite === "oo" || pointAlgebrite === "-oo";
  const limitLatex = `\\lim_{${variable}\\to ${pointAlgebrite}${direction === "right" ? "^+" : direction === "left" ? "^-" : ""}} ${exprAlgebrite}`;

  try {
    // symbolicLimit ya detecta el caso "Algebrite devolvió la llamada sin
    // evaluar" (incluido cuando el punto es oo/-oo, confirmado contra el
    // paquete real) y lanza en ese caso — cae directo al catch de abajo.
    const result = symbolicLimit(exprAlgebrite, variable, pointAlgebrite);
    return {
      resultLatex: result,
      confidence: "SYMBOLIC",
      steps: [
        { id: "original", latex: limitLatex, explanation: "Límite planteado." },
        { id: "result", latex: result, explanation: "Resuelto simbólicamente por Algebrite." },
      ],
    };
  } catch {
    let f;
    try {
      f = compileNumeric(exprAlgebrite, variable);
    } catch (err) {
      throw err as AppError;
    }
    const { value, converged } = isInfinite
      ? numericLimitAtInfinity(f, pointAlgebrite === "oo" ? 1 : -1)
      : numericLimit(f, pointNumeric, direction);
    if (!Number.isFinite(value)) {
      throw { code: ErrorCode.UNSUPPORTED_OPERATION, message: "No se pudo estimar el límite numéricamente (valores no finitos)." } as AppError;
    }
    return {
      resultLatex: value.toFixed(6),
      confidence: "NUMERIC_FALLBACK",
      steps: [
        { id: "original", latex: limitLatex, explanation: "Límite planteado." },
        {
          id: "numeric",
          latex: `\\approx ${value.toFixed(6)}`,
          explanation: converged
            ? isInfinite
              ? "Estimado numéricamente evaluando en magnitudes crecientes (no resuelto simbólicamente)."
              : direction === "both"
                ? "Estimado numéricamente por acercamiento lateral (no resuelto simbólicamente)."
                : `Estimado numéricamente acercándose solo por la ${direction === "right" ? "derecha" : "izquierda"}.`
            : "Estimado numéricamente, pero los lados izquierdo/derecho no convergen al mismo valor — el límite podría no existir.",
        },
      ],
    };
  }
}

export function calcIndefiniteIntegral(exprAlgebrite: string, variable: string): CalculusResult {
  const result = indefiniteIntegral(exprAlgebrite, variable);
  return {
    resultLatex: `${result} + C`,
    confidence: "SYMBOLIC",
    steps: [
      { id: "original", latex: `\\int ${exprAlgebrite}\\,d${variable}`, explanation: "Integral planteada." },
      { id: "result", latex: `${result} + C`, explanation: "Antiderivada calculada simbólicamente (+ constante de integración)." },
    ],
  };
}

export function calcDefiniteIntegral(
  exprAlgebrite: string,
  variable: string,
  lower: number,
  upper: number,
): CalculusResult {
  try {
    const antiderivative = indefiniteIntegral(exprAlgebrite, variable);
    // FIX (Fase 2 externa, hallazgo nuevo): subst() de Algebrite toma
    // (nuevo_valor, variable_vieja, expr), no al revés — mismo bug ya
    // corregido en linearSystem.ts (Fase 1) pero nunca portado aquí. Con
    // el orden viejo (variable, valor, expr) la sustitución nunca hacía
    // nada: daba la antiderivada sin evaluar en los límites (ej.
    // 1/3*x^3 en vez de 8/3 para ∫₀² x² dx), en silencio, sin error.
    //
    // Segundo bug destapado al corregir el primero (nunca se llegaba
    // aquí antes): float(...) de Algebrite devuelve un string con "..."
    // literal cuando el decimal no es exacto (ej. "2.666667..."), y
    // volver a meter ese string en otro evaluate() como si fuera una
    // expresión válida da "NaN...". Se evita el viaje de ida y vuelta
    // por texto combinando la resta en una sola llamada a Algebrite.
    const result = evaluate(
      `float(subst(${upper},${variable},${antiderivative})) - float(subst(${lower},${variable},${antiderivative}))`,
    );
    return {
      resultLatex: result,
      confidence: "SYMBOLIC",
      steps: [
        { id: "original", latex: `\\int_{${lower}}^{${upper}} ${exprAlgebrite}\\,d${variable}`, explanation: "Integral definida planteada." },
        { id: "antiderivative", latex: `${antiderivative} + C`, explanation: "Antiderivada." },
        { id: "result", latex: `= ${result}`, explanation: "Evaluada en los límites (Teorema Fundamental del Cálculo)." },
      ],
    };
  } catch {
    // Fallback numérico por Simpson — spec v10 §7/§10.
    let f;
    try {
      f = compileNumeric(exprAlgebrite, variable);
    } catch (err) {
      throw err as AppError;
    }
    const value = simpsonIntegral(f, lower, upper);
    return {
      resultLatex: value.toFixed(6),
      confidence: "NUMERIC_FALLBACK",
      steps: [
        { id: "original", latex: `\\int_{${lower}}^{${upper}} ${exprAlgebrite}\\,d${variable}`, explanation: "Integral definida planteada." },
        {
          id: "numeric",
          latex: `\\approx ${value.toFixed(6)}`,
          explanation: "Aproximada numéricamente por la regla de Simpson (no se encontró antiderivada simbólica).",
        },
      ],
    };
  }
}
