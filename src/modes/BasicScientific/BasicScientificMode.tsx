import { useCallback, useRef, useState } from "react";
import { NaturalInput } from "../../components/NaturalInput";
import { MathKeyboard } from "../../components/MathKeyboard";
import { ResultPanel } from "../../components/ResultPanel";
import { makeRequestId, ErrorCode, type MathResult } from "../../types";
import { parseExpression } from "../../engine/parsing";
import { addHistoryEntry } from "../../store/historyDb";

// Modo 1 de la spec v10 §5. Orquesta NaturalInput + MathKeyboard +
// ResultPanel, delegando todo el cómputo al Web Worker (nunca al hilo
// principal — regla dura de §3/§12).

export function BasicScientificMode() {
  const [latex, setLatex] = useState("");
  const [result, setResult] = useState<MathResult | null>(null);
  const [angleMode, setAngleMode] = useState<"RAD" | "GRAD">("RAD");
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

  const handleInsert = useCallback((token: string) => {
    // MathLive maneja la inserción real en el campo enfocado; aquí solo se
    // actualiza el estado cuando el usuario usa el teclado propio de la app
    // en vez de escribir directamente en el math-field.
    setLatex((prev) => prev + token);
  }, []);

  const handleCalculate = useCallback(() => {
    const requestId = makeRequestId();

    // El parser (Módulo 2) es liviano (tokenización + reglas de sintaxis,
    // no cómputo simbólico pesado) y corre en el hilo principal a propósito
    // — solo el cálculo con Algebrite pasa al Web Worker (spec v10 §3/§12).
    let algebrite: string;
    try {
      algebrite = parseExpression(latex, angleMode).algebrite;
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
      if (e.data.success) {
        addHistoryEntry({ mode: "Científica", input: latex, resultSummary: e.data.resultLatex ?? "" });
      }
    };
    worker.postMessage({ type: "evaluate", requestId, expressionAlgebrite: algebrite });
  }, [latex, angleMode, getWorker]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-4">
      <NaturalInput value={latex} onChange={setLatex} placeholder="Escribe una expresión…" />
      <ResultPanel result={result} />
      <MathKeyboard
        onInsert={handleInsert}
        onBackspace={() => setLatex((prev) => prev.slice(0, -1))}
        onClear={() => {
          setLatex("");
          setResult(null);
        }}
        onEnter={handleCalculate}
        angleMode={angleMode}
        onToggleAngleMode={() => setAngleMode((m) => (m === "RAD" ? "GRAD" : "RAD"))}
      />
    </div>
  );
}
