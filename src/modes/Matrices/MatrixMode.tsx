import { useCallback, useRef, useState } from "react";
import { MatrixGridInput, makeEmptyMatrix } from "../../components/MatrixGridInput";
import { ResultPanel } from "../../components/ResultPanel";
import { StepList } from "../../components/StepList";
import { makeRequestId, type MathResult } from "../../types";
import { addHistoryEntry } from "../../store/historyDb";

// Modo 5 de la spec v10 §9 (Módulo 6). Tamaño hasta 4x4 con pasos
// detallados, según el mismo criterio que el resto de la spec.
//
// Fase C (spec UX estilo ClassCalc §4): se agregaron ref/rref/A⊗B (antes
// solo add/subtract/multiply/transpose/determinant/inverse/power), y el
// selector de tamaño se reemplazó por steppers +/- con vista previa en
// vivo. También se corrigieron clases rotas desde la Fase 1 (bg-accent/
// bg-panel/text-slate-300 ya no existen en tailwind.config.js — mismo bug
// que tenía ResultPanel.tsx, nadie lo había notado hasta ahora tampoco).
//
// Nota de alcance: ClassCalc además permite nombrar varias matrices (A-F)
// y guardarlas simultáneamente para combinarlas en cualquier expresión.
// Este modo sigue con el esquema de dos "casillas" A/B fijas — el sistema
// de matrices con nombre queda pendiente de una fase futura, no se
// implementó aquí por el alcance que tomaría (un store de matrices
// nombradas + referencias en las operaciones).

type Op = "add" | "subtract" | "multiply" | "kron" | "transpose" | "determinant" | "inverse" | "power" | "ref" | "rref";

const OP_LABELS: Record<Op, string> = {
  add: "A + B",
  subtract: "A − B",
  multiply: "A × B",
  kron: "A ⊗ B",
  transpose: "Aᵀ",
  determinant: "det(A)",
  inverse: "A⁻¹",
  power: "Aⁿ",
  ref: "ref(A)",
  rref: "rref(A)",
};

const NEEDS_B: Op[] = ["add", "subtract", "multiply", "kron"];
const MIN_SIZE = 1;
const MAX_SIZE = 4;

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <span>{label}</span>
      <button
        onClick={() => onChange(Math.max(MIN_SIZE, value - 1))}
        aria-label={`Reducir ${label}`}
        className="h-6 w-6 rounded-full bg-paper-line/60 text-ink hover:bg-paper-line"
      >
        −
      </button>
      <span className="w-4 text-center font-mono text-ink">{value}</span>
      <button
        onClick={() => onChange(Math.min(MAX_SIZE, value + 1))}
        aria-label={`Aumentar ${label}`}
        className="h-6 w-6 rounded-full bg-paper-line/60 text-ink hover:bg-paper-line"
      >
        +
      </button>
    </div>
  );
}

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

  // Steppers independientes de fila/columna (spec §4) — reemplaza los
  // botones fijos 2x2/3x3/4x4 anteriores. Al reducir una dimensión se
  // recorta la matriz existente en vez de vaciarla, para no perder lo ya
  // escrito si el usuario se equivocó de tamaño.
  function resizeA(rows: number, cols: number) {
    setRowsA(rows);
    setColsA(cols);
    setMatrixA((prev) =>
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => prev[r]?.[c] ?? ""),
      ),
    );
  }
  function resizeB(rows: number, cols: number) {
    setRowsB(rows);
    setColsB(cols);
    setMatrixB((prev) =>
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => prev[r]?.[c] ?? ""),
      ),
    );
  }

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
            className={`rounded-full px-3 py-1 ${o === op ? "bg-marker text-chrome" : "bg-paper-soft text-muted"}`}
          >
            {OP_LABELS[o]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4">
        <Stepper label="Filas A" value={rowsA} onChange={(n) => resizeA(n, colsA)} />
        <Stepper label="Col A" value={colsA} onChange={(n) => resizeA(rowsA, n)} />
      </div>
      <MatrixGridInput rows={rowsA} cols={colsA} values={matrixA} onChange={setMatrixA} label="Matriz A" />

      {NEEDS_B.includes(op) && (
        <>
          <div className="flex items-center justify-center gap-4">
            <Stepper label="Filas B" value={rowsB} onChange={(n) => resizeB(n, colsB)} />
            <Stepper label="Col B" value={colsB} onChange={(n) => resizeB(rowsB, n)} />
          </div>
          <MatrixGridInput rows={rowsB} cols={colsB} values={matrixB} onChange={setMatrixB} label="Matriz B" />
        </>
      )}

      {op === "power" && (
        <label className="flex items-center justify-center gap-2 text-sm text-muted">
          Exponente n:
          <input
            type="number"
            min={0}
            value={exponent}
            onChange={(e) => setExponent(parseInt(e.target.value, 10) || 0)}
            className="w-16 rounded bg-paper-soft px-2 py-1 text-center text-ink"
          />
        </label>
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

export { OP_LABELS as MATRIX_OPERATION_LABELS };
export type { Op as MatrixOperation };
