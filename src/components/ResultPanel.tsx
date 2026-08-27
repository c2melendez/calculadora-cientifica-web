import { useState } from "react";
import type { MathResult } from "../types";

// spec v10 §11: el usuario alterna entre formatos sin recalcular.
//
// Fase A (spec UX estilo ClassCalc §2): se agregó "scn" (notación
// científica) y "sqrt" (forma radical) a los formatos ya existentes
// (antes solo impropia/mixta/decimal). "scn" se deriva del decimal con
// toExponential — trivial. "sqrt" no tiene un cálculo real detrás
// todavía: solo muestra resultLatex tal cual lo dejó Algebrite (que a
// veces YA es una forma radical, ej. sqrt(2), pero no se fuerza esa forma
// activamente) — pendiente de un conversor real en una fase futura, no
// se debe asumir que siempre da una forma radical simplificada.
//
// FIX: este componente usaba clases bg-panel/text-accent que ya no
// existen en tailwind.config.js desde la Fase 1 (renombradas a
// paper-soft/marker) — no se habían actualizado, quedó roto visualmente
// sin que nadie lo notara hasta ahora.

type AnswerFormat = "dec" | "frac" | "scn" | "sqrt";

export function ResultPanel({ result }: { result: MathResult | null }) {
  const [format, setFormat] = useState<AnswerFormat>("dec");

  if (!result) {
    return (
      <div className="rounded-xl bg-paper-soft p-4 text-muted">
        Escribe una expresión y presiona Calcular.
      </div>
    );
  }

  if (!result.success) {
    return (
      <div className="rounded-xl bg-paper-soft p-4 text-red-600">
        <p className="font-semibold">No se pudo calcular ({result.errorCode})</p>
        <p className="text-sm text-red-500">{result.errorMessage}</p>
      </div>
    );
  }

  function renderValue(): string {
    if (format === "frac" && result?.fraction) {
      return result.fraction.mixedLatex ?? result.fraction.improperLatex;
    }
    if (format === "scn") {
      const n = Number(result?.fraction?.decimal ?? result?.resultLatex);
      return Number.isFinite(n) ? n.toExponential(6) : (result?.resultLatex ?? "");
    }
    if (format === "dec" && result?.fraction) {
      return result.fraction.decimal;
    }
    // "sqrt", o "dec"/"frac" sin datos de fracción disponibles: se muestra
    // el resultado tal cual lo devolvió el motor.
    return result?.resultLatex ?? "";
  }

  return (
    <div className="rounded-xl bg-paper-soft p-4">
      {result.confidence === "NUMERIC_FALLBACK" && (
        <p className="mb-2 inline-block rounded bg-marker-soft px-2 py-1 text-xs text-marker-text">
          Aproximado numéricamente (no resuelto simbólicamente)
        </p>
      )}

      <div className="mb-2 flex gap-3 text-xs text-muted">
        {(["dec", "frac", "scn", "sqrt"] as AnswerFormat[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            aria-pressed={format === f}
            className={format === f ? "font-semibold text-marker" : "hover:text-ink"}
          >
            {f}
          </button>
        ))}
      </div>
      <p className="font-mono text-3xl text-ink">{renderValue()}</p>
    </div>
  );
}
