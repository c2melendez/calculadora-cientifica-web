import { useEffect, useState } from "react";
import { getAllHistoryEntries, clearHistory, type HistoryEntry } from "../store/historyDb";

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
        <h2 className="text-lg font-semibold text-slate-100">Historial</h2>
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

      {loading && <p className="text-slate-500">Cargando…</p>}
      {!loading && entries.length === 0 && (
        <p className="text-slate-500">Todavía no hay cálculos guardados.</p>
      )}

      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-xl bg-panel p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">{entry.mode}</p>
            <p className="text-slate-100">{entry.input}</p>
            <p className="text-sm text-accent">{entry.resultSummary}</p>
            <p className="text-xs text-slate-600">{new Date(entry.timestamp).toLocaleString()}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
