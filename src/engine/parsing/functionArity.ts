// Etapa 7 (spec v9 §3): valida que cada llamada a función use una aridad
// permitida. log(x) o log(x,b); ln(x) exactamente 1 argumento; el resto de
// funciones conocidas, exactamente 1.

import type { Token } from "./tokenize";
import { FUNCTION_ARITY } from "./constants";
import { ErrorCode, type AppError } from "../../types";

function parseError(message: string): AppError {
  return { code: ErrorCode.PARSE_ERROR, message };
}

export function validateFunctionArity(tokens: Token[]): void {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== "function") continue;

    if (tokens[i + 1]?.type !== "lparen") {
      throw parseError(`Se esperaba "(" después de "${t.value}".`);
    }

    // Paréntesis vacíos inmediatos, ej. "sqrt()" — 0 argumentos, no 1. Sin
    // este chequeo, el conteo de comas de abajo asumía argCount=1 incluso
    // cuando no hay ningún token entre "(" y ")" (bug detectado en revisión).
    if (tokens[i + 2]?.type === "rparen") {
      const allowed = FUNCTION_ARITY[t.value];
      if (allowed && !allowed.includes(0)) {
        throw parseError(`"${t.value}" requiere ${allowed.join(" o ")} argumento(s); no se recibió ninguno.`);
      }
    }

    let depth = 1;
    let j = i + 2;
    let argCount = 1;
    while (j < tokens.length && depth > 0) {
      if (tokens[j].type === "lparen") depth++;
      else if (tokens[j].type === "rparen") depth--;
      else if (tokens[j].type === "comma" && depth === 1) argCount++;
      j++;
    }
    if (depth !== 0) {
      throw parseError(`Paréntesis sin cerrar en la llamada a "${t.value}".`);
    }

    const allowed = FUNCTION_ARITY[t.value];
    if (allowed && !allowed.includes(argCount)) {
      throw parseError(
        `"${t.value}" espera ${allowed.join(" o ")} argumento(s), se recibieron ${argCount}.`,
      );
    }
  }
}
