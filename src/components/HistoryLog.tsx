import { useState } from "react";
import { convertLatexToMarkup } from "mathlive";
import { StepList } from "./StepList";
import type { MathResult } from "../types";

// Fase A (spec UX §2, decisión confirmada): el historial de una línea
// CONVIVE con StepList/ResultPanel — no lo reemplaza. Es de sesión (vive
// en memoria mientras la pestaña está abierta), distinto del historial
// persistente en IndexedDB de HistoryPanel.tsx (ese es para revisar
// cálculos de sesiones anteriores; este es para ver el hilo de la sesión
// actual sin perder el contexto de cada paso).
//
// Fase E (fix display): `entry.input` ya era LaTeX real (viene del
// <math-field> de MathLive), pero se mostraba como texto plano
// ("\sqrt{144}" en vez del símbolo de raíz) — se renderiza ahora con
// convertLatexToMarkup, igual que ResultPanel. Los renglones viejos se
// atenúan progresivamente (opacidad decreciente hacia arriba) para dar
// la sensación de "cinta" de ClassCalc; ya no trae su propio
// fondo/padding, vive anidado dentro de Screen.tsx.

export interface SessionHistoryEntry {
  id: string;
  input: string;
  result: MathResult;
}

function renderLatex(latex: string): { __html: string } {
  return { __html: convertLatexToMarkup(latex) };
}

export function HistoryLog({ entries }: { entries: SessionHistoryEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries.length === 0) return null;

  // Los últimos 2 renglones se muestran atenuados sobre la línea activa;
  // el resto del historial de sesión sigue disponible completo en la
  // pestaña "Historial" (HistoryPanel.tsx / IndexedDB).
  const visible = entries.slice(-3, -1);

  if (visible.length === 0) return null;

  return (
    <ol aria-label="Historial de esta sesión" className="flex flex-col gap-1.5">
      {visible.map((entry, i) => {
        const isExpanded = expandedId === entry.id;
        const hasSteps = entry.result.success && entry.result.steps.length > 0;
        const opacity = i === visible.length - 1 ? "opacity-70" : "opacity-40";
        return (
          <li key={entry.id} className={opacity}>
            <button
              onClick={() => hasSteps && setExpandedId(isExpanded ? null : entry.id)}
              aria-expanded={hasSteps ? isExpanded : undefined}
              className={`flex w-full items-baseline justify-between gap-3 rounded-md px-1 py-0.5 text-left ${
                hasSteps ? "hover:bg-paper-line/40" : "cursor-default"
              }`}
            >
              <span
                className="truncate font-mono text-sm text-muted [&_.ML__base]:text-muted"
                dangerouslySetInnerHTML={renderLatex(entry.input)}
              />
              <span
                className="shrink-0 font-mono text-sm font-semibold text-marker-text [&_.ML__base]:text-marker-text"
                dangerouslySetInnerHTML={
                  entry.result.success ? renderLatex(entry.result.resultLatex ?? "") : { __html: "—" }
                }
              />
            </button>
            {isExpanded && hasSteps && (
              <div className="mt-1 pl-1.5">
                <StepList steps={entry.result.steps} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
