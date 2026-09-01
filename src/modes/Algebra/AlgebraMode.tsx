import { useCallback, useRef, useState } from "react";
import { NaturalInput } from "../../components/NaturalInput";
import { MathKeyboard } from "../../components/MathKeyboard";
import { ResultPanel } from "../../components/ResultPanel";
import { StepList } from "../../components/StepList";
import { makeRequestId, ErrorCode, type MathResult } from "../../types";
import { parseExpression } from "../../engine/parsing";
import { addHistoryEntry } from "../../store/historyDb";

// Modo 2 de la spec v10 §6 (Módulo 3). Requiere que la expresión contenga
// "=" — a diferencia del Modo 1, donde "=" no aplica.

export function AlgebraMode() {
  const [latex, setLatex] = useState("");
  const [result, setResult] = useState<MathResult | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const [mathField, setMathField] = useState<{ insert: (s: string) => void; focus: () => void } | null>(null);

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

  const handleSolve = useCallback(() => {
    const requestId = makeRequestId();
    let parsed;
    try {
      parsed = parseExpression(latex);
    } catch (err) {
      const appErr = err as { code?: ErrorCode; message?: string };
      fail(appErr.code ?? ErrorCode.PARSE_ERROR, appErr.message ?? "Expresión inválida.", requestId);
      return;
    }

    if (!parsed.isEquation) {
      fail(ErrorCode.PARSE_ERROR, 'El modo Álgebra requiere una ecuación con "=".', requestId);
      return;
    }
    // DEDUCIBLE (spec v10 §6, sin especificar): si hay 0 o más de 1 variable
    // libre, se rechaza en vez de adivinar cuál despejar. Ampliar a
    // selección manual de variable queda como TODO de un módulo posterior.
    if (parsed.freeVariables.length !== 1) {
      fail(
        ErrorCode.PARSE_ERROR,
        parsed.freeVariables.length === 0
          ? "No se detectó ninguna variable para despejar."
          : `Hay más de una variable (${parsed.freeVariables.join(", ")}); este módulo aún no permite elegir cuál despejar.`,
        requestId,
      );
      return;
    }

    const variable = parsed.freeVariables[0];
    const worker = getWorker();
    worker.onmessage = (e: MessageEvent<MathResult>) => {
      setResult(e.data);
      if (e.data.success) {
        addHistoryEntry({ mode: "Álgebra", input: latex, resultSummary: e.data.resultLatex ?? "" });
      }
    };
    worker.postMessage({
      type: "solveAlgebra",
      requestId,
      leftAlgebrite: parsed.leftAlgebrite,
      rightAlgebrite: parsed.rightAlgebrite,
      variable,
    });
  }, [latex, getWorker, fail]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-4">
      <NaturalInput value={latex} onChange={setLatex} placeholder="Escribe una ecuación, ej. 2x+3=7" fieldRef={setMathField} />
      <ResultPanel result={result} />
      {result?.steps && result.steps.length > 0 && <StepList steps={result.steps} />}
      <MathKeyboard
        field={mathField}
        onBackspace={() => setLatex((prev) => prev.slice(0, -1))}
        onEnter={handleSolve}
        onClearField={() => setLatex("")}
      />
    </div>
  );
}
