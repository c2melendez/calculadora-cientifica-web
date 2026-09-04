import { useCallback, useRef, useState } from "react";
import { NaturalInput } from "../../components/NaturalInput";
import { GraphViewer, type GraphCurve } from "../../components/GraphViewer";
import { makeRequestId, type MathResult } from "../../types";
import { parseExpression } from "../../engine/parsing";
import type { GraphAnalysis } from "../../engine/stepEngine/graphing";
import { addHistoryEntry } from "../../store/historyDb";

// Modo 6 de la spec v10 §10 (Módulo 7 — el de mayor riesgo del proyecto,
// según la propia spec). Ver README del Módulo 7 sobre el cambio de
// enfoque: todo el análisis es numérico (muestreo + diferencias finitas),
// no un híbrido simbólico-primero. Por eso TODO resultado aquí se marca
// "aproximado", visible en la UI, nunca presentado como exacto.
//
// Fase D (spec UX estilo ClassCalc §6): layout Desmos — lista de
// expresiones a la izquierda (cada una con su color, graficada
// simultáneamente) + lienzo a la derecha con zoom/centrado, en vez de una
// sola expresión a la vez. Se reutiliza el mismo worker "graph" (spec
// v10 §3/§12: el cómputo pesado no sale del worker) — se le pide una
// gráfica por cada expresión activa, correlacionando resultados por
// requestId.

const CURVE_COLORS = ["#E8A33D", "#3E7C74", "#9B7FD6", "#D97757", "#5B94C9"];

interface ExpressionEntry {
  id: string;
  latex: string;
  color: string;
  analysis: GraphAnalysis | null;
  error: string | null;
}

function makeEntry(color: string): ExpressionEntry {
  return { id: makeRequestId(), latex: "", color, analysis: null, error: null };
}

export function GraphingMode() {
  const [entries, setEntries] = useState<ExpressionEntry[]>([makeEntry(CURVE_COLORS[0])]);
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);
  const [view, setView] = useState<[number, number]>([-10, 10]);
  const workerRef = useRef<Worker | null>(null);
  const requestToEntryRef = useRef<Map<string, string>>(new Map());

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../../workers/compute.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current.onmessage = (e: MessageEvent<MathResult>) => {
        const entryId = requestToEntryRef.current.get(e.data.requestId);
        if (!entryId) return;
        requestToEntryRef.current.delete(e.data.requestId);
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === entryId
              ? e.data.success
                ? { ...entry, analysis: e.data.graphAnalysis as GraphAnalysis, error: null }
                : { ...entry, analysis: null, error: e.data.errorMessage ?? "No se pudo graficar." }
              : entry,
          ),
        );
        if (e.data.success) {
          addHistoryEntry({ mode: "Graficación", input: "", resultSummary: e.data.resultLatex ?? "" });
        }
      };
    }
    return workerRef.current;
  }, []);

  const graphEntry = useCallback(
    (entry: ExpressionEntry, currentView: [number, number]) => {
      if (entry.latex.trim() === "") return;
      let parsed;
      try {
        parsed = parseExpression(entry.latex);
      } catch (err) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id ? { ...e, analysis: null, error: (err as { message?: string }).message ?? "Expresión inválida." } : e,
          ),
        );
        return;
      }
      if (parsed.freeVariables.length !== 1) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id ? { ...e, analysis: null, error: "La expresión debe tener exactamente una variable (ej. x)." } : e,
          ),
        );
        return;
      }
      const requestId = makeRequestId();
      requestToEntryRef.current.set(requestId, entry.id);
      getWorker().postMessage({
        type: "graph",
        requestId,
        expressionAlgebrite: parsed.algebrite,
        variable: parsed.freeVariables[0],
        view: currentView,
      });
    },
    [getWorker],
  );

  function updateLatex(id: string, latex: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, latex } : e)));
  }

  function submitEntry(entry: ExpressionEntry) {
    graphEntry(entry, view);
  }

  function addExpression() {
    const nextColor = CURVE_COLORS[entries.length % CURVE_COLORS.length];
    const entry = makeEntry(nextColor);
    setEntries((prev) => [...prev, entry]);
    setSelectedId(entry.id);
  }

  function removeExpression(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  // Bug conocido de la versión anterior, todavía vigente: "desde"==
  // "hasta" divide entre cero al escalar en GraphViewer — se valida antes
  // de aplicar un nuevo rango de vista.
  function applyZoom(factor: number) {
    const [a, b] = view;
    const center = (a + b) / 2;
    const halfRange = ((b - a) / 2) * factor;
    if (halfRange < 0.01) return; // evita colapsar el rango a (casi) cero
    const nextView: [number, number] = [center - halfRange, center + halfRange];
    setView(nextView);
    entries.forEach((entry) => graphEntry(entry, nextView));
  }

  function recenter() {
    const nextView: [number, number] = [-10, 10];
    setView(nextView);
    entries.forEach((entry) => graphEntry(entry, nextView));
  }

  const curves: GraphCurve[] = entries
    .filter((e): e is ExpressionEntry & { analysis: GraphAnalysis } => e.analysis !== null)
    .map((e) => ({ id: e.id, color: e.color, analysis: e.analysis }));
  const selectedEntry = entries.find((e) => e.id === selectedId) ?? null;
  const selectedAnalysis = selectedEntry?.analysis ?? null;

  return (
    <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start lg:gap-6 dt:mx-auto dt:max-w-[1440px] dt:gap-10">
      {/* Sidebar de expresiones (spec §6) */}
      <div className="flex w-full flex-col gap-2 md:w-56">
        {entries.map((entry) => (
          <div
            key={entry.id}
            onClick={() => setSelectedId(entry.id)}
            className={`flex items-center gap-2 rounded-lg p-2 ${entry.id === selectedId ? "bg-paper-line/50" : ""}`}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
            <div className="min-w-0 flex-1">
              <NaturalInput
                value={entry.latex}
                onChange={(v) => updateLatex(entry.id, v)}
                placeholder="f(x), ej. x^2-4"
              />
            </div>
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                submitEntry(entry);
              }}
              aria-label="Graficar esta expresión"
              className="shrink-0 text-xs text-marker hover:text-marker-text"
            >
              ⏎
            </button>
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                removeExpression(entry.id);
              }}
              aria-label="Eliminar expresión"
              className="shrink-0 text-muted hover:text-red-500"
            >
              ×
            </button>
          </div>
        ))}
        <button onClick={addExpression} className="self-start rounded-md bg-paper-soft px-3 py-1.5 text-sm text-marker hover:bg-paper-line/40">
          + Agregar expresión
        </button>
      </div>

      {/* Lienzo (spec §6) */}
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-end gap-1.5">
          <button onClick={() => applyZoom(0.7)} aria-label="Acercar" className="h-7 w-7 rounded-md bg-paper-line/50 text-ink hover:bg-paper-line">
            +
          </button>
          <button onClick={() => applyZoom(1.4)} aria-label="Alejar" className="h-7 w-7 rounded-md bg-paper-line/50 text-ink hover:bg-paper-line">
            −
          </button>
          <button onClick={recenter} aria-label="Centrar" className="h-7 w-7 rounded-md bg-paper-line/50 text-ink hover:bg-paper-line">
            ⊙
          </button>
        </div>

        {curves.length > 0 ? (
          <GraphViewer curves={curves} selectedId={selectedId} view={view} />
        ) : (
          <div className="flex h-52 items-center justify-center rounded-xl bg-chrome text-sm text-bone/50">
            Escribe una expresión y presiona ⏎ para graficarla.
          </div>
        )}

        {selectedEntry?.error && (
          <div className="rounded-xl bg-paper-soft p-3 text-sm text-red-600">{selectedEntry.error}</div>
        )}

        {selectedAnalysis && (
          <>
            <p className="inline-block rounded bg-marker-soft px-2 py-1 text-xs text-marker-text">
              Análisis aproximado por muestreo numérico, no simbólico exacto.
            </p>
            <div className="flex flex-col gap-1 rounded-xl bg-paper-soft p-4 text-sm text-ink">
              <p><span className="text-muted">Dominio:</span> {selectedAnalysis.domainDescription}</p>
              <p><span className="text-muted">Rango:</span> {selectedAnalysis.rangeDescription}</p>
              <p>
                <span className="text-muted">Intercepciones en x:</span>{" "}
                {selectedAnalysis.xIntercepts.length ? selectedAnalysis.xIntercepts.map((x) => x.toFixed(3)).join(", ") : "ninguna en la vista actual"}
              </p>
              <p>
                <span className="text-muted">Intercepción en y:</span>{" "}
                {selectedAnalysis.yIntercept !== null ? selectedAnalysis.yIntercept.toFixed(3) : "no definida en x=0"}
              </p>
              <p>
                <span className="text-muted">Máximo global:</span>{" "}
                {selectedAnalysis.globalMax ? `(${selectedAnalysis.globalMax.x.toFixed(3)}, ${selectedAnalysis.globalMax.y.toFixed(3)})` : "—"}
              </p>
              <p>
                <span className="text-muted">Mínimo global:</span>{" "}
                {selectedAnalysis.globalMin ? `(${selectedAnalysis.globalMin.x.toFixed(3)}, ${selectedAnalysis.globalMin.y.toFixed(3)})` : "—"}
              </p>
              <p>
                <span className="text-muted">Vértice:</span>{" "}
                {selectedAnalysis.vertex ? `(${selectedAnalysis.vertex.x.toFixed(3)}, ${selectedAnalysis.vertex.y.toFixed(3)})` : "no aplica"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
