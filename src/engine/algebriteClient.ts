// Único punto de contacto con Algebrite en todo el proyecto (regla de capa
// dura, spec v10 §3). Ningún componente de /modes o /components debe hacer
// `import Algebrite from "algebrite"` directamente.

import Algebrite from "algebrite";
import { ErrorCode, type AppError } from "../types";

function toAppError(code: ErrorCode, message: string): AppError {
  return { code, message };
}

/** Evalúa/simplifica una expresión. Lanza AppError normalizado en caso de fallo. */
export function evaluate(expressionLatex: string): string {
  try {
    // Algebrite trabaja con su propia sintaxis de entrada; la conversión
    // LaTeX -> sintaxis Algebrite vive en stepEngine/parsing (Módulo 2B,
    // pendiente). Por ahora se asume que el llamador ya entrega una cadena
    // compatible (ver NaturalInput.getAlgebriteString()).
    const result = Algebrite.run(expressionLatex);
    if (typeof result !== "string" || result.length === 0) {
      throw toAppError(ErrorCode.PARSE_ERROR, "Algebrite no devolvió resultado.");
    }
    if (/stop|Stop/.test(result)) {
      throw toAppError(ErrorCode.PARSE_ERROR, `Algebrite reportó un error: ${result}`);
    }
    return result;
  } catch (err) {
    if ((err as AppError).code) throw err;
    throw toAppError(ErrorCode.PARSE_ERROR, `Fallo inesperado al evaluar: ${String(err)}`);
  }
}

/** Deriva una expresión respecto a una variable, orden 1-3 (spec v10 §7). */
export function derivative(expressionAlgebrite: string, variable: string, order: 1 | 2 | 3 = 1): string {
  try {
    let expr = expressionAlgebrite;
    for (let i = 0; i < order; i++) {
      expr = Algebrite.run(`d(${expr},${variable})`);
    }
    return expr;
  } catch (err) {
    throw toAppError(ErrorCode.COMPLEXITY_LIMIT, `No se pudo derivar de orden ${order}: ${String(err)}`);
  }
}

/** Resuelve una ecuación de una variable. */
export function solveEquation(equationAlgebrite: string, variable: string): string[] {
  try {
    const result = Algebrite.run(`roots(${equationAlgebrite},${variable})`);
    if (/stop|Stop/.test(result)) {
      throw toAppError(ErrorCode.UNSUPPORTED_OPERATION, `No se pudo resolver: ${result}`);
    }
    // Algebrite devuelve un vector de raíces separadas por coma cuando hay
    // más de una; se normaliza a array de strings.
    return result.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim());
  } catch (err) {
    if ((err as AppError).code) throw err;
    throw toAppError(ErrorCode.UNSUPPORTED_OPERATION, `Fallo al resolver ecuación: ${String(err)}`);
  }
}

export { ErrorCode };
