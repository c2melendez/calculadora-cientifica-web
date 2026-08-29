import { useCallback, useRef, useState } from "react";
import { NaturalInput } from "../../components/NaturalInput";
import { ResultPanel } from "../../components/ResultPanel";
import { StepList } from "../../components/StepList";
import { makeRequestId, ErrorCode, type MathResult } from "../../types";
import { parseExpression } from "../../engine/parsing";
import { addHistoryEntry } from "../../store/historyDb";

// FIX (auditoría Fase 0 v2): este componente usaba clases bg-accent/
// accentSoft/bg-panel/text-slate-* que ya no existen en tailwind.config.js
// desde la Fase 1 (mismo bug ya corregido en MatrixMode.tsx, este archivo
// había quedado sin actualizar).

// Modo 3 de la spec v10 §7 (Módulo 4). A diferencia de los modos 1 y 2, los
// parámetros auxiliares (punto del límite, orden de derivada, límites de
// integración) se piden como campos numéricos simples, no como NaturalInput
// — TODO declarado: llevarlos a input natural en un módulo posterior si se
// necesita, por ejemplo, límites en infinito escritos como "\infty".

type Operation = "limit" | "derivative" | "indefiniteIntegral" | "definiteIntegral";

const OPERATION_LABELS: Record<Operation, string> = {
  limit: "Límite",
  derivative: "Derivada",
  indefiniteIntegral: "Integral indefinida",
  definiteIntegral: "Integral definida",
};

export function CalculusMode() {
  const [operation, setOperation] = useState<Operation>("derivative");
  const [latex, setLatex] = useState("");
  const [point, setPoint] = useState("0");
  const [order, setOrder] = useState<1 | 2 | 3>(1);
  const [lower, setLower] = useState("0");
  const [upper, setUpper] = useState("1");
  const [result, setResult] = useState<MathResult | null>(null);
  const workerRef = useRef<Worker | null>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../../workers/compute.worker.ts", import.meta.url),
        { type: "module" },
      );
    }
    return workerRef.current;
  }, []);

  const fail = useCallback((code: ErrorCode, message: string, requestId: string) => {
    setResult({
      success: false,
      errorCode: code,
      errorMessage: message,
      resultLatex: null,
      steps: [],
      hasDetailedSteps: false,
      confidence: "SYMBOLIC",
      requestId,
    });
  }, []);

  const handleCompute = useCallback(() => {
    const requestId = makeRequestId();
    let parsed;
    try {
      parsed = parseExpression(latex);
    } catch (err) {
      const appErr = err as { code?: ErrorCode; message?: string };
      fail(appErr.code ?? ErrorCode.PARSE_ERROR, appErr.message ?? "Expresión inválida.", requestId);
      return;
    }
    if (parsed.freeVariables.length !== 1) {
      fail(
        ErrorCode.PARSE_ERROR,
        "Esta expresión debe tener exactamente una variable (ej. x).",
        requestId,
      );
      return;
    }
    const variable = parsed.freeVariables[0];
    const worker = getWorker();
    worker.onmessage = (e: MessageEvent<MathResult>) => {
      setResult(e.data);
      if (e.data.success) {
        addHistoryEntry({ mode: `Cálculo (${operation})`, input: latex, resultSummary: e.data.resultLatex ?? "" });
      }
    };

    if (operation === "derivative") {
      worker.postMessage({
        type: "derivative",
        requestId,
        expressionAlgebrite: parsed.algebrite,
        variable,
        order,
      });
    } else if (operation === "limit") {
      const pointNumeric = parseFloat(point);
      if (Number.isNaN(pointNumeric)) {
        fail(ErrorCode.PARSE_ERROR, "El punto del límite debe ser un número.", requestId);
        return;
      }
      worker.postMessage({
        type: "limit",
        requestId,
        expressionAlgebrite: parsed.algebrite,
        variable,
        pointAlgebrite: point,
        pointNumeric,
      });
    } else if (operation === "indefiniteIntegral") {
      worker.postMessage({
        type: "indefiniteIntegral",
        requestId,
        expressionAlgebrite: parsed.algebrite,
        variable,
      });
    } else {
      const lowerNumeric = parseFloat(lower);
      const upperNumeric = parseFloat(upper);
      if (Number.isNaN(lowerNumeric) || Number.isNaN(upperNumeric)) {
        fail(ErrorCode.PARSE_ERROR, "Los límites de integración deben ser números.", requestId);
        return;
      }
      worker.postMessage({
        type: "definiteIntegral",
        requestId,
        expressionAlgebrite: parsed.algebrite,
        variable,
        lower: lowerNumeric,
        upper: upperNumeric,
      });
    }
  }, [latex, operation, order, point, lower, upper, getWorker, fail]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-4">
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        {(Object.keys(OPERATION_LABELS) as Operation[]).map((op) => (
          <button
            key={op}
            onClick={() => setOperation(op)}
            className={`rounded-full px-3 py-1 ${
              op === operation ? "bg-marker text-chrome" : "bg-paper-soft text-muted"
            }`}
          >
            {OPERATION_LABELS[op]}
          </button>
        ))}
      </div>

      <NaturalInput value={latex} onChange={setLatex} placeholder="f(x), ej. sin(x)/x" />

      {operation === "derivative" && (
        <label className="flex items-center gap-2 text-sm text-muted">
          Orden:
          <select
            value={order}
            onChange={(e) => setOrder(Number(e.target.value) as 1 | 2 | 3)}
            className="rounded bg-paper-soft px-2 py-1 text-ink"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
      )}

      {operation === "limit" && (
        <label className="flex items-center gap-2 text-sm text-muted">
          x →
          <input
            value={point}
            onChange={(e) => setPoint(e.target.value)}
            className="w-24 rounded bg-paper-soft px-2 py-1 text-ink"
            placeholder="0"
          />
        </label>
      )}

      {operation === "definiteIntegral" && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <label className="flex items-center gap-1">
            desde
            <input
              value={lower}
              onChange={(e) => setLower(e.target.value)}
              className="w-16 rounded bg-paper-soft px-2 py-1 text-ink"
            />
          </label>
          <label className="flex items-center gap-1">
            hasta
            <input
              value={upper}
              onChange={(e) => setUpper(e.target.value)}
              className="w-16 rounded bg-paper-soft px-2 py-1 text-ink"
            />
          </label>
        </div>
      )}

      <button
        onClick={handleCompute}
        className="rounded-lg bg-graph py-2 text-lg font-semibold text-paper hover:bg-graph/90"
      >
        Calcular
      </button>

      <ResultPanel result={result} />
      {result?.steps && result.steps.length > 0 && <StepList steps={result.steps} />}
    </div>
  );
}
