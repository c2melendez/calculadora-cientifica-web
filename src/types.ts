// Contrato de datos central — spec v10 §4. Todo modo produce/consume MathResult.

export enum ErrorCode {
  PARSE_ERROR = "PARSE_ERROR",
  UNSUPPORTED_OPERATION = "UNSUPPORTED_OPERATION",
  COMPLEXITY_LIMIT = "COMPLEXITY_LIMIT",
  DIMENSION_MISMATCH = "DIMENSION_MISMATCH",
  DOMAIN_ERROR = "DOMAIN_ERROR",
  TIMEOUT = "TIMEOUT",
  NUMERIC_FALLBACK_FAILED = "NUMERIC_FALLBACK_FAILED",
}

export interface AppError {
  code: ErrorCode;
  message: string;
}

export type ResultConfidence = "SYMBOLIC" | "NUMERIC_FALLBACK" | "PARTIAL";

export interface Step {
  id: string;
  latex: string;
  explanation: string;
  /** Opcional — nombre corto del paso, ej. "Derivar cada factor". */
  title?: string;
  /** Opcional — regla aplicada, ej. "Regla del producto". */
  rule?: string;
  /** Opcional — expresión antes de aplicar la regla. Si no está presente,
   * la tarjeta muestra solo `latex` como resultado del paso. */
  latexBefore?: string;
}

export interface FractionResult {
  improperLatex: string;
  mixedLatex: string | null;
  decimal: string;
}

export interface MathResult {
  success: boolean;
  errorCode?: ErrorCode;
  errorMessage?: string;
  resultLatex: string | null;
  fraction?: FractionResult;
  steps: Step[];
  hasDetailedSteps: boolean;
  confidence: ResultConfidence;
  requestId: string;
  /** Presente solo en resultados del Modo Graficación — datos para GraphViewer. Tipado como unknown aquí para evitar un import circular con stepEngine/graphing.ts; se castea en GraphingMode.tsx. */
  graphAnalysis?: unknown;
}

export function makeRequestId(): string {
  // uuid v4 simplificado, suficiente para historial local (no expone nada
  // sensible ni requiere librería adicional)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
