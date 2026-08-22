/// <reference lib="webworker" />

// Todo cálculo simbólico corre en este worker (spec v10 §3, §12) para no
// congelar el hilo principal en dispositivos móviles de gama baja.
// Módulo 1: solo soporta "evaluate" (Modo 1 - calculadora básica/científica).
// Los demás tipos de operación se añaden en módulos posteriores.

import { evaluate } from "../engine/algebriteClient";
import { toFractionResult } from "../engine/fractions";
import { ErrorCode, makeRequestId, type MathResult, type AppError } from "../types";

export type ComputeRequest =
  | { type: "evaluate"; requestId: string; expressionAlgebrite: string };

self.onmessage = (event: MessageEvent<ComputeRequest>) => {
  const msg = event.data;
  const result = handle(msg);
  (self as unknown as Worker).postMessage(result);
};

function handle(msg: ComputeRequest): MathResult {
  switch (msg.type) {
    case "evaluate":
      return handleEvaluate(msg.expressionAlgebrite, msg.requestId);
    default:
      return errorResult(ErrorCode.UNSUPPORTED_OPERATION, "Tipo de operación desconocido.", msg.requestId ?? makeRequestId());
  }
}

function handleEvaluate(expr: string, requestId: string): MathResult {
  try {
    const raw = evaluate(expr);
    const isNumeric = /^-?\d+(\.\d+)?$/.test(raw) || /^-?\d+\/\d+$/.test(raw);
    return {
      success: true,
      resultLatex: raw,
      fraction: isNumeric ? toFractionResult(raw) : undefined,
      steps: [],
      hasDetailedSteps: false,
      confidence: "SYMBOLIC",
      requestId,
    };
  } catch (err) {
    const appErr = err as AppError;
    return errorResult(
      appErr.code ?? ErrorCode.PARSE_ERROR,
      appErr.message ?? String(err),
      requestId,
    );
  }
}

function errorResult(code: ErrorCode, message: string, requestId: string): MathResult {
  return {
    success: false,
    errorCode: code,
    errorMessage: message,
    resultLatex: null,
    steps: [],
    hasDetailedSteps: false,
    confidence: "SYMBOLIC",
    requestId,
  };
}
