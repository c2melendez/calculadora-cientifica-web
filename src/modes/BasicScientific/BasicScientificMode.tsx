import { useCallback, useRef, useState } from "react";
import { MathKeyboard } from "../../components/MathKeyboard";
import { Screen } from "../../components/Screen";
import { type SessionHistoryEntry } from "../../components/HistoryLog";
import { makeRequestId, ErrorCode, type MathResult } from "../../types";
import { parseExpression } from "../../engine/parsing";
import { addHistoryEntry } from "../../store/historyDb";

// Modo 1 de la spec v10 §5. Orquesta NaturalInput + MathKeyboard +
// ResultPanel, delegando todo el cómputo al Web Worker (nunca al hilo
// principal — regla dura de §3/§12).
//
// Fase A (spec UX estilo ClassCalc): el teclado ahora inserta con
// field.insert() (cursor-aware, plantillas #0) en vez de concatenar texto
// al final — se guarda una referencia real al <math-field>. El popover
// DEG/RAD sale del teclado y vive en el header de este modo.

type MathFieldRef = { insert: (s: string) => void; focus: () => void; value: string } | null;

export function BasicScientificMode() {
  const [latex, setLatex] = useState("");
  const [result, setResult] = useState<MathResult | null>(null);
  const [angleMode, setAngleMode] = useState<"RAD" | "GRAD">("RAD");
  const workerRef = useRef<Worker | null>(null);
  const [mathField, setMathField] = useState<MathFieldRef>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>([]);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../../workers/compute.worker.ts", import.meta.url),
        { type: "module" },
      );
    }
    return workerRef.current;
  }, []);

  const runExpression = useCallback(
    (exprLatex: string) => {
      const requestId = makeRequestId();

      // El parser (Módulo 2) es liviano (tokenización + reglas de sintaxis,
      // no cómputo simbólico pesado) y corre en el hilo principal a propósito
      // — solo el cálculo con Algebrite pasa al Web Worker (spec v10 §3/§12).
      let algebrite: string;
      try {
        algebrite = parseExpression(exprLatex, angleMode).algebrite;
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
          addHistoryEntry({ mode: "Científica", input: exprLatex, resultSummary: e.data.resultLatex ?? "" });
          setSessionHistory((prev) => [
            ...prev,
            { id: e.data.requestId, input: exprLatex, result: e.data },
          ]);
        }
      };
      worker.postMessage({ type: "evaluate", requestId, expressionAlgebrite: algebrite });
    },
    [angleMode, getWorker],
  );

  const handleCalculate = useCallback(() => runExpression(latex), [latex, runExpression]);

  // Íconos de resolución (spec §3.4). "Resolver ecuación" y "simplificar"
  // reusan el mismo pipeline de evaluate() ya existente — Algebrite ya
  // simplifica cualquier expresión, y ya resuelve ecuaciones con "="
  // (equationSplit.ts). El ícono de sistema navega conceptualmente a
  // LinearSystemsMode en vez de intentar resolverlo aquí — no se
  // implementó una vista de sistema embebida en este modo todavía.
  const handleSolveEquation = useCallback(() => {
    if (!latex.includes("=")) {
      mathField?.insert("=0");
      return;
    }
    handleCalculate();
  }, [latex, handleCalculate, mathField]);

  const handleSimplify = useCallback(() => handleCalculate(), [handleCalculate]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-4">
      <Screen
        latex={latex}
        onChangeLatex={setLatex}
        placeholder="Escribe una expresión…"
        fieldRef={setMathField}
        result={result}
        sessionHistory={sessionHistory}
        angleMode={angleMode}
        onToggleAngleMode={() => setAngleMode((m) => (m === "RAD" ? "GRAD" : "RAD"))}
      />
      <MathKeyboard
        field={mathField}
        onBackspace={() => setLatex((prev) => prev.slice(0, -1))}
        onEnter={handleCalculate}
        onSolveEquation={handleSolveEquation}
        onSimplify={handleSimplify}
      />
    </div>
  );
}
