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

// Modo 4 de la spec v10 §8 (Módulo 5). Soporta de 2 a 4 ecuaciones
// (DEDUCIBLE, spec no fija un límite — se eligió por paridad con matrices
// hasta 4x4). Cada ecuación se resuelve con el parser del Módulo 2 y se
// valida linealidad en `linearSystem.ts` antes de armar la matriz aumentada.

const MIN_EQUATIONS = 2;
const MAX_EQUATIONS = 4;

export function LinearSystemsMode() {
  const [count, setCount] = useState(2);
  const [equations, setEquations] = useState<string[]>(["", ""]);
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

  const setCountAndResize = (n: number) => {
    setCount(n);
    setEquations((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push("");
      return next;
    });
  };

  const fail = (code: ErrorCode, message: string, requestId: string) => {
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
  };

  const handleSolve = useCallback(() => {
    const requestId = makeRequestId();
    const allVariables = new Set<string>();
    const equationsAlgebrite: string[] = [];

    for (const eq of equations) {
      let parsed;
      try {
        parsed = parseExpression(eq);
      } catch (err) {
        const appErr = err as { code?: ErrorCode; message?: string };
        fail(appErr.code ?? ErrorCode.PARSE_ERROR, appErr.message ?? "Ecuación inválida.", requestId);
        return;
      }
      if (!parsed.isEquation) {
        fail(ErrorCode.PARSE_ERROR, `Cada renglón debe ser una ecuación con "=": "${eq}".`, requestId);
        return;
      }
      parsed.freeVariables.forEach((v) => allVariables.add(v));
      equationsAlgebrite.push(parsed.algebrite);
    }

    const variables = [...allVariables].sort();
    if (variables.length !== equations.length) {
      fail(
        ErrorCode.PARSE_ERROR,
        `Se detectaron ${variables.length} variable(s) distintas (${variables.join(", ") || "ninguna"}) pero hay ${equations.length} ecuaciones. Para una solución determinada, el número de variables debe igualar al de ecuaciones.`,
        requestId,
      );
      return;
    }

    const worker = getWorker();
    worker.onmessage = (e: MessageEvent<MathResult>) => {
      setResult(e.data);
      if (e.data.success) {
        addHistoryEntry({ mode: "Sistemas", input: equations.join(" ; "), resultSummary: e.data.resultLatex ?? "" });
      }
    };
    worker.postMessage({ type: "linearSystem", requestId, equationsAlgebrite, variables });
  }, [equations, getWorker]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-4">
      <div className="flex justify-center gap-2 text-sm">
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => setCountAndResize(n)}
            className={`rounded-full px-3 py-1 ${
              n === count ? "bg-marker text-chrome" : "bg-paper-soft text-muted"
            }`}
          >
            {n} ecuaciones
          </button>
        ))}
      </div>

      {equations.map((eq, i) => (
        <NaturalInput
          key={i}
          value={eq}
          onChange={(v) =>
            setEquations((prev) => prev.map((p, idx) => (idx === i ? v : p)))
          }
          placeholder={`Ecuación ${i + 1}, ej. ${i === 0 ? "2x+y=5" : "x-y=1"}`}
        />
      ))}

      <button
        onClick={handleSolve}
        className="rounded-lg bg-graph py-2 text-lg font-semibold text-paper hover:bg-graph/90"
      >
        Resolver sistema
      </button>

      <ResultPanel result={result} />
      {result?.steps && result.steps.length > 0 && <StepList steps={result.steps} />}
    </div>
  );
}

export const LINEAR_SYSTEM_LIMITS = { MIN_EQUATIONS, MAX_EQUATIONS };
