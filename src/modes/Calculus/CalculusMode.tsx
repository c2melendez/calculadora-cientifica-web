import { useCallback, useRef, useState } from "react";
import { Screen } from "../../components/Screen";
import { type SessionHistoryEntry } from "../../components/HistoryLog";
import { StepList } from "../../components/StepList";
import { makeRequestId, ErrorCode, type MathResult } from "../../types";
import { parseExpression } from "../../engine/parsing";
import { addHistoryEntry } from "../../store/historyDb";

// FIX (auditoría Fase 0 v2): este componente usaba clases bg-accent/
// accentSoft/bg-panel/text-slate-* que ya no existen en tailwind.config.js
// desde la Fase 1 (mismo bug ya corregido en MatrixMode.tsx, este archivo
// había quedado sin actualizar).

// Fase E (migración del patrón de pantalla unificada, pendiente de la
// fase anterior): NaturalInput+ResultPanel sueltos -> Screen, igual que en
// BasicScientificMode. Este modo no tenía angleMode (siempre RAD implícito
// vía el default de parseExpression) ni historial de sesión — se agregaron
// ambos aquí para que la pantalla compartida sea real, no un toggle
// decorativo que no hiciera nada.

type MathFieldRef = { insert: (s: string) => void; focus: () => void; value: string } | null;

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
  const [direction, setDirection] = useState<"both" | "left" | "right">("both");
  const [order, setOrder] = useState(1);
  const [lower, setLower] = useState("0");
  const [upper, setUpper] = useState("1");
  const [result, setResult] = useState<MathResult | null>(null);
  const [angleMode, setAngleMode] = useState<"RAD" | "GRAD">("RAD");
  const [, setMathField] = useState<MathFieldRef>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>([]);
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
      parsed = parseExpression(latex, angleMode);
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
        setSessionHistory((prev) => [...prev, { id: e.data.requestId, input: latex, result: e.data }]);
      }
    };

    if (operation === "derivative") {
      if (!Number.isInteger(order) || order < 1 || order > 20) {
        fail(ErrorCode.PARSE_ERROR, "El orden debe ser un entero entre 1 y 20.", requestId);
        return;
      }
      worker.postMessage({
        type: "derivative",
        requestId,
        expressionAlgebrite: parsed.algebrite,
        variable,
        order,
      });
    } else if (operation === "limit") {
      // Fase 3 (paridad con la pantalla única): "oo"/"-oo" ya no se
      // rechazan acá — normalize.ts los acepta desde \infty en la
      // notación natural, y calcLimit (compute.worker.ts) ya sabe
      // resolverlos numéricamente cuando Algebrite no puede
      // simbólicamente. pointNumeric solo importa para el caso finito
      // (numericLimit necesita un número real para evaluar cerca de él);
      // para oo/-oo se ignora en calcLimit (usa numericLimitAtInfinity).
      const isInfinitePoint = point === "oo" || point === "-oo";
      const pointNumeric = isInfinitePoint ? 0 : parseFloat(point);
      if (!isInfinitePoint && Number.isNaN(pointNumeric)) {
        fail(ErrorCode.PARSE_ERROR, 'El punto del límite debe ser un número, o "oo"/"-oo" para infinito.', requestId);
        return;
      }
      worker.postMessage({
        type: "limit",
        requestId,
        expressionAlgebrite: parsed.algebrite,
        variable,
        pointAlgebrite: point,
        pointNumeric,
        direction,
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
  }, [latex, operation, order, point, direction, lower, upper, angleMode, getWorker, fail]);

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

      <Screen
        latex={latex}
        onChangeLatex={setLatex}
        placeholder="f(x), ej. sin(x)/x"
        fieldRef={setMathField}
        result={result}
        sessionHistory={sessionHistory}
        angleMode={angleMode}
        onToggleAngleMode={() => setAngleMode((m) => (m === "RAD" ? "GRAD" : "RAD"))}
        onClearField={() => setLatex("")}
      />

      {operation === "derivative" && (
        <label className="flex items-center gap-2 text-sm text-muted">
          Orden:
          <input
            type="number"
            min={1}
            max={20}
            step={1}
            value={order}
            onChange={(e) => setOrder(Math.round(Number(e.target.value)))}
            className="w-16 rounded bg-paper-soft px-2 py-1 text-ink"
          />
          <span className="text-xs text-muted">(1-20)</span>
        </label>
      )}

      {operation === "limit" && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <label className="flex items-center gap-2">
            x →
            <input
              value={point}
              onChange={(e) => setPoint(e.target.value)}
              className="w-24 rounded bg-paper-soft px-2 py-1 text-ink"
              placeholder="0, oo, -oo"
            />
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPoint("oo")}
              className="rounded-full border border-paper-line px-2 py-0.5 text-xs hover:border-marker/40 hover:text-marker"
            >
              ∞
            </button>
            <button
              type="button"
              onClick={() => setPoint("-oo")}
              className="rounded-full border border-paper-line px-2 py-0.5 text-xs hover:border-marker/40 hover:text-marker"
            >
              −∞
            </button>
          </div>
          <label className="flex items-center gap-2">
            Lado:
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "both" | "left" | "right")}
              className="rounded bg-paper-soft px-2 py-1 text-ink"
            >
              <option value="both">ambos (x → a)</option>
              <option value="right">derecha (x → a⁺)</option>
              <option value="left">izquierda (x → a⁻)</option>
            </select>
          </label>
        </div>
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

      {result?.steps && result.steps.length > 0 && <StepList steps={result.steps} />}
    </div>
  );
}