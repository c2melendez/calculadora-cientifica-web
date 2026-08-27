import { useState } from "react";
import { StepList } from "./StepList";
import type { MathResult } from "../types";

// Fase A (spec UX §2, decisión confirmada): el historial de una línea
// CONVIVE con StepList/ResultPanel — no lo reemplaza. Es de sesión (vive
// en memoria mientras la pestaña está abierta), distinto del historial
// persistente en IndexedDB de HistoryPanel.tsx (ese es para revisar
// cálculos de sesiones anteriores; este es para ver el hilo de la sesión
// actual sin perder el contexto de cada paso).

export interface SessionHistoryEntry {
  id: string;
  input: string;
  result: MathResult;
}

export function HistoryLog({ entries }: { entries: SessionHistoryEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (entries.length === 0) return null;

  return (
    <ol className="flex flex-col gap-1 rounded-xl bg-paper-soft p-3" aria-label="Historial de esta sesión">
      {entries.map((entry) => {
        const isExpanded = expandedId === entry.id;
        const hasSteps = entry.result.success && entry.result.steps.length > 0;
        return (
          <li key={entry.id}>
            <button
              onClick={() => hasSteps && setExpandedId(isExpanded ? null : entry.id)}
              aria-expanded={hasSteps ? isExpanded : undefined}
              className={`flex w-full items-baseline justify-between gap-3 rounded-md px-1.5 py-1 text-left font-mono text-sm ${
                hasSteps ? "hover:bg-paper-line/40" : "cursor-default"
              }`}
            >
              <span className="truncate text-muted">{entry.input}</span>
              <span className="shrink-0 font-semibold text-marker-text">
                {entry.result.success ? entry.result.resultLatex : "—"}
              </span>
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
