import { useCallback, useRef, useState } from "react";
import { MatrixGridInput, makeEmptyMatrix } from "../../components/MatrixGridInput";
import { ResultPanel } from "../../components/ResultPanel";
import { StepList } from "../../components/StepList";
import { makeRequestId, type MathResult } from "../../types";
import { addHistoryEntry } from "../../store/historyDb";

// Modo 5 de la spec v10 §9 (Módulo 6). Tamaño hasta 4x4 con pasos
// detallados, según el mismo criterio que el resto de la spec.

type Op = "add" | "subtract" | "multiply" | "transpose" | "determinant" | "inverse" | "power";

const OP_LABELS: Record<Op, string> = {
  add: "A + B",
  subtract: "A − B",
  multiply: "A × B",
  transpose: "Aᵀ",
  determinant: "det(A)",
  inverse: "A⁻¹",
  power: "Aⁿ",
};

const NEEDS_B: Op[] = ["add", "subtract", "multiply"];

export function MatrixMode() {
  const [op, setOp] = useState<Op>("add");
  const [rowsA, setRowsA] = useState(2);
  const [colsA, setColsA] = useState(2);
  const [rowsB, setRowsB] = useState(2);
  const [colsB, setColsB] = useState(2);
  const [matrixA, setMatrixA] = useState(makeEmptyMatrix(2, 2));
  const [matrixB, setMatrixB] = useState(makeEmptyMatrix(2, 2));
  const [exponent, setExponent] = useState(2);
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

  const resizeA = (r: number, c: number) => {
    setRowsA(r);
    setColsA(c);
    setMatrixA(makeEmptyMatrix(r, c));
  };
  const resizeB = (r: number, c: number) => {
    setRowsB(r);
    setColsB(c);
    setMatrixB(makeEmptyMatrix(r, c));
  };

  const handleCompute = useCallback(() => {
    const requestId = makeRequestId();
    const worker = getWorker();
    worker.onmessage = (e: MessageEvent<MathResult>) => {
      setResult(e.data);
      if (e.data.success) {
        addHistoryEntry({ mode: `Matrices (${OP_LABELS[op]})`, input: JSON.stringify(matrixA), resultSummary: e.data.resultLatex ?? "" });
      }
    };

    if (NEEDS_B.includes(op)) {
      worker.postMessage({ type: "matrixOp", requestId, op, a: matrixA, b: matrixB });
    } else if (op === "power") {
      worker.postMessage({ type: "matrixOp", requestId, op, a: matrixA, exponent });
    } else {
      worker.postMessage({ type: "matrixOp", requestId, op, a: matrixA });
    }
  }, [op, matrixA, matrixB, exponent, getWorker]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-4">
      <div className="flex flex-wrap justify-center gap-2 text-sm">
        {(Object.keys(OP_LABELS) as Op[]).map((o) => (
          <button
            key={o}
            onClick={() => setOp(o)}
            className={`rounded-full px-3 py-1 ${o === op ? "bg-accent text-white" : "bg-panel text-slate-300"}`}
          >
            {OP_LABELS[o]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
        <span>Tamaño A:</span>
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => resizeA(n, n)}
            className={`rounded px-2 py-1 ${rowsA === n ? "bg-accent text-white" : "bg-panel"}`}
          >
            {n}x{n}
          </button>
        ))}
      </div>
      <MatrixGridInput rows={rowsA} cols={colsA} values={matrixA} onChange={setMatrixA} label="Matriz A" />

      {NEEDS_B.includes(op) && (
        <>
          <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
            <span>Tamaño B:</span>
            {[2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => resizeB(n, n)}
                className={`rounded px-2 py-1 ${rowsB === n ? "bg-accent text-white" : "bg-panel"}`}
              >
                {n}x{n}
              </button>
            ))}
          </div>
          <MatrixGridInput rows={rowsB} cols={colsB} values={matrixB} onChange={setMatrixB} label="Matriz B" />
        </>
      )}

      {op === "power" && (
        <label className="flex items-center justify-center gap-2 text-sm text-slate-300">
          Exponente n:
          <input
            type="number"
            min={0}
            value={exponent}
            onChange={(e) => setExponent(parseInt(e.target.value, 10) || 0)}
            className="w-16 rounded bg-panel px-2 py-1 text-center text-slate-100"
          />
        </label>
      )}

      <button
        onClick={handleCompute}
        className="rounded-lg bg-accent py-2 text-lg font-semibold text-white hover:bg-accentSoft"
      >
        Calcular
      </button>

      <ResultPanel result={result} />
      {result?.steps && result.steps.length > 0 && <StepList steps={result.steps} />}
    </div>
  );
}

export { OP_LABELS as MATRIX_OPERATION_LABELS };
export type { Op as MatrixOperation };
