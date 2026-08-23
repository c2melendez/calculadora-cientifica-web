// Etapa 8 (spec v9 §3): se divide por el PRIMER "="; más de un "=" es
// PARSE_ERROR; si no hay "=", se asume "= 0" (la expresión es válida tal
// cual para modos que no requieren ecuación, como el Modo 1).

import { ErrorCode, type AppError } from "../../types";

function parseError(message: string): AppError {
  return { code: ErrorCode.PARSE_ERROR, message };
}

export interface EquationSplit {
  left: string;
  right: string;
  isEquation: boolean;
}

export function splitEquation(expr: string): EquationSplit {
  const parts = expr.split("=");
  if (parts.length > 2) {
    throw parseError('Más de un signo "=" en la expresión.');
  }
  if (parts.length === 1) {
    return { left: parts[0], right: "0", isEquation: false };
  }
  return { left: parts[0], right: parts[1], isEquation: true };
}
