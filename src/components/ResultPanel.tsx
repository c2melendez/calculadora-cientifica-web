import { useState } from "react";
import type { MathResult } from "../types";

// spec v10 §11: el usuario alterna entre impropia/mixta/decimal sin
// recalcular — los tres formatos ya vienen resueltos en FractionResult.

type FractionView = "improper" | "mixed" | "decimal";

export function ResultPanel({ result }: { result: MathResult | null }) {
  const [view, setView] = useState<FractionView>("decimal");

  if (!result) {
    return (
      <div className="rounded-xl bg-panel p-4 text-slate-500">
        Escribe una expresión y presiona Calcular.
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="rounded-xl bg-panel p-4 text-red-400">
        <p className="font-semibold">No se pudo calcular ({result.errorCode})</p>
        <p className="text-sm text-red-300">{result.errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-panel p-4">
      {result.confidence === "NUMERIC_FALLBACK" && (
        <p className="mb-2 inline-block rounded bg-amber-900/40 px-2 py-1 text-xs text-amber-300">
          Aproximado numéricamente (no resuelto simbólicamente)
        </p>
      )}

      {result.fraction ? (
        <div>
          <div className="mb-2 flex gap-3 text-xs text-slate-400">
            <button
              className={view === "improper" ? "text-accent" : ""}
              onClick={() => setView("improper")}
            >
              impropia
            </button>
            {result.fraction.mixedLatex && (
              <button
                className={view === "mixed" ? "text-accent" : ""}
                onClick={() => setView("mixed")}
              >
                mixta
              </button>
            )}
            <button
              className={view === "decimal" ? "text-accent" : ""}
              onClick={() => setView("decimal")}
            >
              decimal
            </button>
          </div>
          <p className="text-3xl text-slate-100">
            {view === "improper" && result.fraction.improperLatex}
            {view === "mixed" && (result.fraction.mixedLatex ?? result.fraction.improperLatex)}
            {view === "decimal" && result.fraction.decimal}
          </p>
        </div>
      ) : (
        <p className="text-3xl text-slate-100">{result.resultLatex}</p>
      )}
    </div>
  );
}
