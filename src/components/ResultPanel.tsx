import { useState } from "react";
import { convertLatexToMarkup } from "mathlive";
import type { MathResult } from "../types";

// spec v10 §11: el usuario alterna entre formatos sin recalcular.
//
// Fase E (fix display, detectado por comparación visual con ClassCalc):
// dos cambios de fondo sobre la versión anterior.
// 1) Se renderiza con convertLatexToMarkup (MathLive) en vez de texto
//    plano — ahora que compute.worker.ts realmente entrega LaTeX válido
//    en resultLatex (antes era la sintaxis nativa de Algebrite sin
//    convertir, ver algebriteClient.ts).
// 2) "dec" ahora usa decimalApprox como segundo fallback cuando no hay
//    `fraction` (resultado simbólico, ej. sin(pi/4)) — antes caía
//    directo a resultLatex y mostraba el mismo string simbólico en las
//    4 pestañas.
//
// Ya no trae su propio fondo/padding/sombra: vive anidado dentro de
// Screen.tsx, que es quien da el contenedor "pantalla" único (spec UX
// estilo ClassCalc, decisión del mockup).

type AnswerFormat = "dec" | "frac" | "scn" | "sqrt";

function renderLatex(latex: string): { __html: string } {
  return { __html: convertLatexToMarkup(latex) };
}

export function ResultPanel({ result }: { result: MathResult | null }) {
  const [format, setFormat] = useState<AnswerFormat>("dec");

  if (!result) {
    return <p className="py-1 text-right text-sm text-muted">Escribe una expresión y presiona Calcular.</p>;
  }

  if (!result.success) {
    return (
      <div className="py-1 text-right text-red-600">
        <p className="text-sm font-semibold">No se pudo calcular ({result.errorCode})</p>
        <p className="text-xs text-red-500">{result.errorMessage}</p>
      </div>
    );
  }

  function renderValue(): { latex: string; isPlainNumber: boolean } {
    if (format === "frac" && result?.fraction) {
      return { latex: result.fraction.mixedLatex ?? result.fraction.improperLatex, isPlainNumber: false };
    }
    if (format === "scn") {
      // fraction.decimal y decimalApprox pueden traer "…" al final cuando
      // el motor truncó un decimal periódico (fractions.ts / Fase E en
      // algebriteClient.ts) — Number() necesita el string limpio.
      const source = (result?.fraction?.decimal ?? result?.decimalApprox ?? result?.resultLatex ?? "").replace(
        "…",
        "",
      );
      const n = Number(source);
      return Number.isFinite(n)
        ? { latex: n.toExponential(6), isPlainNumber: true }
        : { latex: result?.resultLatex ?? "", isPlainNumber: false };
    }
    if (format === "dec") {
      // Orden de fallback: fracción exacta -> decimal, luego float()
      // forzado sobre un resultado simbólico (Fase E), y solo si ninguno
      // de los dos existe, el resultado tal cual (mejor que nada).
      if (result?.fraction) return { latex: result.fraction.decimal, isPlainNumber: true };
      if (result?.decimalApprox) return { latex: result.decimalApprox, isPlainNumber: true };
      return { latex: result?.resultLatex ?? "", isPlainNumber: false };
    }
    // "sqrt", o "frac" sin datos de fracción disponibles: se muestra el
    // resultado tal cual lo devolvió el motor (ya es LaTeX real).
    return { latex: result?.resultLatex ?? "", isPlainNumber: false };
  }

  const { latex, isPlainNumber } = renderValue();

  return (
    <div className="pt-1">
      {result.confidence === "NUMERIC_FALLBACK" && (
        <p className="mb-1.5 inline-block rounded bg-marker-soft px-2 py-0.5 text-xs text-marker-text">
          Aproximado numéricamente (no resuelto simbólicamente)
        </p>
      )}
      <div className="flex items-end justify-between gap-3">
        {isPlainNumber ? (
          <span className="ml-auto font-mono text-3xl font-medium text-ink">{latex}</span>
        ) : (
          <span
            className="ml-auto font-mono text-3xl text-ink [&_.ML__base]:text-ink"
            dangerouslySetInnerHTML={renderLatex(latex)}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-end gap-3 text-xs text-muted">
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
    </div>
  );
}
