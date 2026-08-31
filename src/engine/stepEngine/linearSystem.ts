// stepEngine/linearSystem.ts (spec v10 §8, Módulo 5 — Modo Sistemas).
//
// Truco de extracción de coeficientes: para una ecuación LINEAL en forma
// "expr = 0" (ya combinada por el parser), el coeficiente de cada variable
// v es simplemente d(expr, v) evaluado — si el sistema es de verdad lineal,
// esa derivada es una constante (sin variables). El término independiente
// es expr evaluada con todas las variables en 0. Esto evita escribir un
// extractor de coeficientes propio y reutiliza el motor simbólico que ya
// existe (Algebrite `d()`), con una validación explícita de linealidad.

import { evaluate, derivative, ErrorCode } from "../algebriteClient";
import { gaussJordan, toFractionMatrix, type SystemSolution } from "../matrixOps";
import type { AppError } from "../../types";

function linearError(message: string): AppError {
  return { code: ErrorCode.UNSUPPORTED_OPERATION, message };
}

/** Extrae {coeficientes, constante} de una ecuación combinada ("expr = 0"), validando que sea lineal. */
function extractRow(equationAlgebrite: string, variables: string[]): { coeffs: string[]; constant: string } {
  const coeffs: string[] = [];

  for (const v of variables) {
    const coeff = derivative(equationAlgebrite, v, 1);
    // Validación de linealidad: la derivada respecto a v no debe contener
    // ninguna otra variable del sistema (si las contuviera, el término
    // original tenía un producto de variables, es decir, no es lineal).
    for (const other of variables) {
      if (other !== v && new RegExp(`\\b${other}\\b`).test(coeff)) {
        throw linearError(
          `La ecuación no es lineal (el término con "${v}" y "${other}" está multiplicado entre sí). Este modo solo resuelve sistemas lineales.`,
        );
      }
    }
    coeffs.push(coeff);
  }

  let substituted = equationAlgebrite;
  for (const v of variables) {
    // Fase 1 (fusión de modos): bug preexistente confirmado contra el
    // paquete real de Algebrite — subst() toma (nuevo_valor,
    // variable_vieja, expr), NO (variable_vieja, valor, expr). El orden
    // invertido hacía que la sustitución nunca reemplazara nada, dejando
    // "constant" con variables libres sin evaluar (ej. "5-2*x-y" en vez
    // de un número), lo que rompía toFractionMatrix() para CUALQUIER
    // sistema — no solo casos límite. Este bug ya causaba que
    // tests/linearSystem.test.ts fallara antes de esta fase; ahora que
    // el router de la pantalla única también depende de esta función, se
    // corrige acá en vez de dejarlo pendiente.
    substituted = `subst(0,${v},${substituted})`;
  }
  const constant = evaluate(substituted);

  return { coeffs, constant };
}

/**
 * Resuelve un sistema lineal de N ecuaciones (2-4, spec v10 §8) dado un
 * array de ecuaciones ya combinadas por el parser ("expr = 0" cada una) y
 * el conjunto de variables del sistema, en el orden en que se reportan.
 */
export function solveLinearSystem(equationsAlgebrite: string[], variables: string[]): SystemSolution {
  if (equationsAlgebrite.length !== variables.length) {
    throw linearError(
      `Se requieren tantas ecuaciones como variables para una solución única (${variables.length} variables, ${equationsAlgebrite.length} ecuaciones dadas). Con menos ecuaciones el sistema queda indeterminado; con más, puede ser inconsistente — ambos casos se reportan igual si se resuelve.`,
    );
  }

  const rows = equationsAlgebrite.map((eq) => {
    const { coeffs, constant } = extractRow(eq, variables);
    // expr = sum(coef*var) + constante = 0  =>  sum(coef*var) = -constante
    const rhs = evaluate(`-(${constant})`);
    return [...coeffs, rhs];
  });

  const augmented = toFractionMatrix(rows);
  return gaussJordan(augmented, variables);
}
