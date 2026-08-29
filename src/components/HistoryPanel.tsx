import { useEffect, useState } from "react";
import { getAllHistoryEntries, clearHistory, type HistoryEntry } from "../store/historyDb";

// FIX (auditoría Fase 0 v2): este componente usaba clases bg-panel/
// text-slate-*/text-accent que ya no existen en tailwind.config.js desde
// la Fase 1 (mismo bug ya corregido antes en ResultPanel.tsx y
// MatrixGridInput.tsx, pero este archivo había quedado sin actualizar).

export function HistoryPanel() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setEntries(await getAllHistoryEntries());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-ink">Historial</h2>
        <button
          onClick={async () => {
            await clearHistory();
            load();
          }}
          className="text-sm text-red-400 hover:text-red-300"
        >
          Borrar todo
        </button>
      </div>

      {loading && <p className="text-muted">Cargando…</p>}
      {!loading && entries.length === 0 && (
        <p className="text-muted">Todavía no hay cálculos guardados.</p>
      )}

      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-xl bg-paper-soft p-3">
            <p className="text-xs uppercase tracking-wide text-muted">{entry.mode}</p>
            <p className="text-ink">{entry.input}</p>
            <p className="text-sm text-marker">{entry.resultSummary}</p>
            <p className="text-xs text-muted">{new Date(entry.timestamp).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
