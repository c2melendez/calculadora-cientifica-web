/// <reference lib="webworker" />

// Todo cálculo simbólico corre en este worker (spec v10 §3, §12) para no
// congelar el hilo principal en dispositivos móviles de gama baja.
// Módulo 1: "evaluate" (Modo 1). Módulo 3: "solveAlgebra" (Modo 2 - Álgebra).
// Los demás tipos de operación se añaden en módulos posteriores.

import { evaluate, ErrorCode as ClientErrorCode } from "../engine/algebriteClient";
import { toFractionResult } from "../engine/fractions";
import { compileNumeric, numericLimit } from "../engine/numericFallback";
import { tryStatFunction, splitTopLevelArgs } from "../engine/statFunctions";
import { solveAlgebra } from "../engine/stepEngine/algebra";
import {
  calcDerivative,
  calcLimit,
  calcIndefiniteIntegral,
  calcDefiniteIntegral,
} from "../engine/stepEngine/calculus";
import { solveLinearSystem } from "../engine/stepEngine/linearSystem";
import {
  toFractionMatrix,
  addMatrices,
  subtractMatrices,
  multiplyMatrices,
  transposeMatrix,
  determinant,
  invertMatrix,
  powerMatrix,
  ref,
  rref,
  kroneckerProduct,
} from "../engine/matrixOps";
import { analyzeGraph } from "../engine/stepEngine/graphing";
import { ErrorCode, makeRequestId, type MathResult, type AppError } from "../types";

export type ComputeRequest =
  | { type: "evaluate"; requestId: string; expressionAlgebrite: string }
  | {
      type: "solveAlgebra";
      requestId: string;
      leftAlgebrite: string;
      rightAlgebrite: string;
      variable: string;
    }
  | {
      type: "derivative";
      requestId: string;
      expressionAlgebrite: string;
      variable: string;
      order: 1 | 2 | 3;
    }
  | {
      type: "limit";
      requestId: string;
      expressionAlgebrite: string;
      variable: string;
      pointAlgebrite: string;
      pointNumeric: number;
    }
  | { type: "indefiniteIntegral"; requestId: string; expressionAlgebrite: string; variable: string }
  | {
      type: "definiteIntegral";
      requestId: string;
      expressionAlgebrite: string;
      variable: string;
      lower: number;
      upper: number;
    }
  | { type: "linearSystem"; requestId: string; equationsAlgebrite: string[]; variables: string[] }
  | {
      type: "matrixOp";
      requestId: string;
      op: "add" | "subtract" | "multiply" | "transpose" | "determinant" | "inverse" | "power" | "ref" | "rref" | "kron";
      a: (string | number)[][];
      b?: (string | number)[][];
      exponent?: number;
    }
  | { type: "graph"; requestId: string; expressionAlgebrite: string; variable: string; view: [number, number] };

self.onmessage = (event: MessageEvent<ComputeRequest>) => {
  const msg = event.data;
  const result = handle(msg);
  (self as unknown as Worker).postMessage(result);
};

function handle(msg: ComputeRequest): MathResult {
  switch (msg.type) {
    case "evaluate":
      return handleEvaluate(msg.expressionAlgebrite, msg.requestId);
    case "solveAlgebra":
      return handleSolveAlgebra(msg.leftAlgebrite, msg.rightAlgebrite, msg.variable, msg.requestId);
    case "derivative":
      return runCalculus(msg.requestId, () => calcDerivative(msg.expressionAlgebrite, msg.variable, msg.order));
    case "limit":
      return runCalculus(msg.requestId, () =>
        calcLimit(msg.expressionAlgebrite, msg.variable, msg.pointAlgebrite, msg.pointNumeric),
      );
    case "indefiniteIntegral":
      return runCalculus(msg.requestId, () => calcIndefiniteIntegral(msg.expressionAlgebrite, msg.variable));
    case "definiteIntegral":
      return runCalculus(msg.requestId, () =>
        calcDefiniteIntegral(msg.expressionAlgebrite, msg.variable, msg.lower, msg.upper),
      );
    case "linearSystem":
      return handleLinearSystem(msg.equationsAlgebrite, msg.variables, msg.requestId);
    case "matrixOp":
      return handleMatrixOp(msg, msg.requestId);
    case "graph":
      return handleGraph(msg.expressionAlgebrite, msg.variable, msg.view, msg.requestId);
    default: {
      const unknownMsg = msg as { requestId?: string };
      return errorResult(
        ErrorCode.UNSUPPORTED_OPERATION,
        "Tipo de operación desconocido.",
        unknownMsg.requestId ?? makeRequestId(),
      );
    }
  }
}

function handleSolveAlgebra(
  leftAlgebrite: string,
  rightAlgebrite: string,
  variable: string,
  requestId: string,
): MathResult {
  try {
    const { steps, solutionsAlgebrite } = solveAlgebra(leftAlgebrite, rightAlgebrite, variable);
    const allNumeric = solutionsAlgebrite.every(
      (s) => /^-?\d+(\.\d+)?$/.test(s) || /^-?\d+\/\d+$/.test(s),
    );
    return {
      success: true,
      resultLatex: solutionsAlgebrite.map((s) => `${variable} = ${s}`).join(", "),
      fraction: allNumeric && solutionsAlgebrite.length === 1 ? toFractionResult(solutionsAlgebrite[0]) : undefined,
      steps,
      hasDetailedSteps: false, // ver stepEngine/algebra.ts: pasos de alto nivel, no aislamiento término a término
      confidence: "SYMBOLIC",
      requestId,
    };
  } catch (err) {
    const appErr = err as AppError;
    return errorResult(
      appErr.code ?? ClientErrorCode.UNSUPPORTED_OPERATION,
      appErr.message ?? String(err),
      requestId,
    );
  }
}

/**
 * Fase 3: Algebrite nunca evalúa asinh/acosh/atanh/sign a un número —
 * confirmado probando el paquete real, no solo con evaluate() (que ya
 * reintenta con float()) sino incluso llamándolo directo. Si el resultado
 * de evaluate() todavía contiene alguna de estas, se recurre al
 * evaluador numérico propio (engine/numericFallback.ts) como último
 * recurso antes de rendirse.
 */
const ALGEBRITE_UNSUPPORTED_NUMERIC = /\b(asinh|acosh|atanh|sign)\(/;

/**
 * Fase 10 (decisión: resolver Lim inline en Básica/Científica/Álgebra):
 * limit() de Algebrite frecuentemente devuelve la llamada tal cual, sin
 * evaluar (confirmado probando el paquete real — mismo comportamiento que
 * ya maneja symbolicLimit()/calcLimit() en el modo Cálculo). Cuando eso
 * pasa aquí, se recurre al mismo fallback numérico que usa Cálculo
 * (compileNumeric + numericLimit), reconstruyendo cuerpo/variable/punto a
 * partir de la propia llamada sin evaluar.
 */
function tryLimitFallback(raw: string): string | null {
  const match = raw.match(/^limit\((.*)\)$/s);
  if (!match) return null;
  const args = splitTopLevelArgs(match[1]);
  if (args.length !== 3) return null;
  const [body, variable, pointExpr] = args;
  try {
    const pointRaw = evaluate(pointExpr);
    const pointNumeric = Number(pointRaw);
    if (!Number.isFinite(pointNumeric)) return null;
    const fn = compileNumeric(body, variable);
    const { value, converged } = numericLimit(fn, pointNumeric);
    return Number.isFinite(value) && converged ? String(value) : null;
  } catch {
    return null;
  }
}

function tryNumericFallback(expr: string): string | null {
  try {
    // Expresión puramente numérica (sin variable libre real que resolver
    // aquí) — se compila con un nombre de variable que no debería
    // aparecer en la expresión, y se evalúa en un punto cualquiera.
    const fn = compileNumeric(expr, "__evaluate_no_var__");
    const value = fn(0);
    return Number.isFinite(value) ? String(value) : null;
  } catch {
    return null;
  }
}

function handleEvaluate(expr: string, requestId: string): MathResult {
  try {
    // Fase 10: mean/median/mode/stdev/variance/sort/mad/min/max no son
    // nativas de Algebrite (confirmado, ver statFunctions.ts) — se
    // resuelven aparte, antes de intentar el camino normal.
    const statResult = tryStatFunction(expr);
    if (statResult !== null) {
      const isNumericStat = /^-?\d+(\.\d+)?$/.test(statResult);
      return {
        success: true,
        resultLatex: statResult,
        fraction: isNumericStat ? toFractionResult(statResult) : undefined,
        steps: [],
        hasDetailedSteps: false,
        confidence: "NUMERIC_FALLBACK",
        requestId,
      };
    }

    let raw = evaluate(expr);
    let confidence: MathResult["confidence"] = "SYMBOLIC";
    if (/^limit\(/.test(raw)) {
      const limitFallback = tryLimitFallback(raw);
      if (limitFallback !== null) {
        raw = limitFallback;
        confidence = "NUMERIC_FALLBACK";
      }
    }
    if (ALGEBRITE_UNSUPPORTED_NUMERIC.test(raw)) {
      const numeric = tryNumericFallback(expr);
      if (numeric !== null) {
        raw = numeric;
        confidence = "NUMERIC_FALLBACK";
      }
    }
    const isNumeric = /^-?\d+(\.\d+)?$/.test(raw) || /^-?\d+\/\d+$/.test(raw);
    return {
      success: true,
      resultLatex: raw,
      fraction: isNumeric ? toFractionResult(raw) : undefined,
      steps: [],
      hasDetailedSteps: false,
      confidence,
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

function runCalculus(
  requestId: string,
  fn: () => { resultLatex: string; steps: MathResult["steps"]; confidence: MathResult["confidence"] },
): MathResult {
  try {
    const { resultLatex, steps, confidence } = fn();
    return {
      success: true,
      resultLatex,
      steps,
      hasDetailedSteps: true,
      confidence,
      requestId,
    };
  } catch (err) {
    const appErr = err as AppError;
    return errorResult(
      appErr.code ?? ClientErrorCode.UNSUPPORTED_OPERATION,
      appErr.message ?? String(err),
      requestId,
    );
  }
}

function handleLinearSystem(equationsAlgebrite: string[], variables: string[], requestId: string): MathResult {
  try {
    const solution = solveLinearSystem(equationsAlgebrite, variables);
    if (solution.kind === "none") {
      return errorResult(ErrorCode.UNSUPPORTED_OPERATION, "El sistema no tiene solución (es inconsistente).", requestId);
    }
    if (solution.kind === "infinite") {
      return {
        success: true,
        resultLatex: "Infinitas soluciones (sistema compatible indeterminado).",
        steps: solution.steps,
        hasDetailedSteps: true,
        confidence: "PARTIAL", // no se calcula la parametrización explícita todavía — ver README
        requestId,
      };
    }
    const values = solution.values!;
    return {
      success: true,
      resultLatex: variables.map((v, i) => `${v} = ${values[i].toFraction(true)}`).join(", "),
      fraction: values.length === 1 ? toFractionResult(values[0].toFraction()) : undefined,
      steps: solution.steps,
      hasDetailedSteps: true,
      confidence: "SYMBOLIC",
      requestId,
    };
  } catch (err) {
    const appErr = err as AppError;
    return errorResult(appErr.code ?? ClientErrorCode.UNSUPPORTED_OPERATION, appErr.message ?? String(err), requestId);
  }
}

function handleMatrixOp(
  msg: Extract<ComputeRequest, { type: "matrixOp" }>,
  requestId: string,
): MathResult {
  try {
    const a = toFractionMatrix(msg.a);
    const b = msg.b ? toFractionMatrix(msg.b) : undefined;

    let resultLatex: string;
    let steps: MathResult["steps"];
    let fraction: MathResult["fraction"];

    switch (msg.op) {
      case "add": {
        const { result, steps: s } = addMatrices(a, b!);
        resultLatex = result.map((row) => row.map((v) => v.toFraction(true)).join(", ")).join(" | ");
        steps = s;
        break;
      }
      case "subtract": {
        const { result, steps: s } = subtractMatrices(a, b!);
        resultLatex = result.map((row) => row.map((v) => v.toFraction(true)).join(", ")).join(" | ");
        steps = s;
        break;
      }
      case "multiply": {
        const { result, steps: s } = multiplyMatrices(a, b!);
        resultLatex = result.map((row) => row.map((v) => v.toFraction(true)).join(", ")).join(" | ");
        steps = s;
        break;
      }
      case "transpose": {
        const { result, steps: s } = transposeMatrix(a);
        resultLatex = result.map((row) => row.map((v) => v.toFraction(true)).join(", ")).join(" | ");
        steps = s;
        break;
      }
      case "determinant": {
        const { value, steps: s } = determinant(a);
        resultLatex = value.toFraction(true);
        fraction = toFractionResult(value.toFraction());
        steps = s;
        break;
      }
      case "inverse": {
        const { result, steps: s } = invertMatrix(a);
        resultLatex = result.map((row) => row.map((v) => v.toFraction(true)).join(", ")).join(" | ");
        steps = s;
        break;
      }
      case "power": {
        const { result, steps: s } = powerMatrix(a, msg.exponent ?? 1);
        resultLatex = result.map((row) => row.map((v) => v.toFraction(true)).join(", ")).join(" | ");
        steps = s;
        break;
      }
      case "ref": {
        const { result, steps: s } = ref(a);
        resultLatex = result.map((row) => row.map((v) => v.toFraction(true)).join(", ")).join(" | ");
        steps = s;
        break;
      }
      case "rref": {
        const { result, steps: s } = rref(a);
        resultLatex = result.map((row) => row.map((v) => v.toFraction(true)).join(", ")).join(" | ");
        steps = s;
        break;
      }
      case "kron": {
        const { result, steps: s } = kroneckerProduct(a, b!);
        resultLatex = result.map((row) => row.map((v) => v.toFraction(true)).join(", ")).join(" | ");
        steps = s;
        break;
      }
    }

    return {
      success: true,
      resultLatex,
      fraction,
      steps,
      hasDetailedSteps: true,
      confidence: "SYMBOLIC",
      requestId,
    };
  } catch (err) {
    const appErr = err as AppError;
    return errorResult(appErr.code ?? ClientErrorCode.UNSUPPORTED_OPERATION, appErr.message ?? String(err), requestId);
  }
}

function handleGraph(
  exprAlgebrite: string,
  variable: string,
  view: [number, number],
  requestId: string,
): MathResult {
  try {
    const analysis = analyzeGraph(exprAlgebrite, variable, view);
    const summary = [
      `Dominio: ${analysis.domainDescription}`,
      `Rango: ${analysis.rangeDescription}`,
      `Intercepciones en x: ${analysis.xIntercepts.length ? analysis.xIntercepts.map((x) => x.toFixed(3)).join(", ") : "ninguna detectada en el rango visible"}`,
      `Intercepción en y: ${analysis.yIntercept !== null ? analysis.yIntercept.toFixed(3) : "no definida en x=0"}`,
    ].join(" · ");
    return {
      success: true,
      resultLatex: summary,
      steps: [],
      hasDetailedSteps: false,
      confidence: "NUMERIC_FALLBACK",
      requestId,
      graphAnalysis: analysis,
    };
  } catch (err) {
    const appErr = err as AppError;
    return errorResult(appErr.code ?? ClientErrorCode.UNSUPPORTED_OPERATION, appErr.message ?? String(err), requestId);
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
