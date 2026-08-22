import { useCallback, useRef, useState } from "react";
import { NaturalInput } from "../../components/NaturalInput";
import { MathKeyboard } from "../../components/MathKeyboard";
import { ResultPanel } from "../../components/ResultPanel";
import { makeRequestId, type MathResult } from "../../types";
import { latexToAlgebrite } from "./latexToAlgebrite";

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
    const worker = getWorker();
    const requestId = makeRequestId();
    worker.onmessage = (e: MessageEvent<MathResult>) => setResult(e.data);
    worker.postMessage({
      type: "evaluate",
      requestId,
      expressionAlgebrite: latexToAlgebrite(latex, angleMode),
    });
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
