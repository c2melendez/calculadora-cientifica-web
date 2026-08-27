import { useCallback, useRef, useState } from "react";
import { NaturalInput } from "../../components/NaturalInput";
import { SimpleKeyboard } from "../../components/SimpleKeyboard";
import { ResultPanel } from "../../components/ResultPanel";
import { makeRequestId, ErrorCode, type MathResult } from "../../types";
import { parseExpression } from "../../engine/parsing";

// Fase B (spec UX §5): modo Basic — calculadora de 4 operaciones, sin
// trig/log/cálculo. No existía en ningún proyecto (confirmado en
// auditoría) — es el único de los 4 modos que se construyó desde cero.
// Reutiliza el mismo NaturalInput + parseExpression + Web Worker que
// Scientific (no hay razón para un motor de cómputo distinto, solo un
// teclado más simple) — angleMode es irrelevante aquí (no hay trig), se
// fija en "RAD" sin exponer el toggle.

type MathFieldRef = { insert: (s: string) => void; focus: () => void; value: string } | null;

export function SimpleBasicMode() {
  const [latex, setLatex] = useState("");
  const [result, setResult] = useState<MathResult | null>(null);
  const [mathField, setMathField] = useState<MathFieldRef>(null);
  const workerRef = useRef<Worker | null>(null);

  // Recall de expresiones anteriores con ←/→ (distinto del HistoryLog de
  // Scientific: aquí solo se navega el campo de entrada, no se muestra un
  // listado — coherente con el modo "reducido" de Basic).
  const pastInputsRef = useRef<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../../workers/compute.worker.ts", import.meta.url),
        { type: "module" },
      );
    }
    return workerRef.current;
  }, []);

  const handleCalculate = useCallback(() => {
    const requestId = makeRequestId();
    let algebrite: string;
    try {
      algebrite = parseExpression(latex, "RAD").algebrite;
    } catch (err) {
      const appErr = err as { code?: ErrorCode; message?: string };
      setResult({
        success: false,
        errorCode: appErr.code ?? ErrorCode.PARSE_ERROR,
        errorMessage: appErr.message ?? "Expresión inválida.",
        resultLatex: null,
        steps: [],
        hasDetailedSteps: false,
        confidence: "SYMBOLIC",
        requestId,
      });
      return;
    }

    const worker = getWorker();
    worker.onmessage = (e: MessageEvent<MathResult>) => {
      setResult(e.data);
      if (e.data.success && latex.trim() !== "") {
        pastInputsRef.current = [...pastInputsRef.current, latex];
        setHistoryIndex(null);
      }
    };
    worker.postMessage({ type: "evaluate", requestId, expressionAlgebrite: algebrite });
  }, [latex, getWorker]);

  function historyBack() {
    const past = pastInputsRef.current;
    if (past.length === 0) return;
    const nextIndex = historyIndex === null ? past.length - 1 : Math.max(0, historyIndex - 1);
    setHistoryIndex(nextIndex);
    setLatex(past[nextIndex]);
  }

  function historyForward() {
    const past = pastInputsRef.current;
    if (historyIndex === null) return;
    const nextIndex = historyIndex + 1;
    if (nextIndex >= past.length) {
      setHistoryIndex(null);
      setLatex("");
      return;
    }
    setHistoryIndex(nextIndex);
    setLatex(past[nextIndex]);
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-3 p-4">
      <NaturalInput value={latex} onChange={setLatex} placeholder="0" fieldRef={setMathField} />
      <ResultPanel result={result} />
      <SimpleKeyboard
        field={mathField}
        onBackspace={() => setLatex((prev) => prev.slice(0, -1))}
        onEnter={handleCalculate}
        onHistoryBack={historyBack}
        onHistoryForward={historyForward}
      />
    </div>
  );
}
