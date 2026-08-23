import { useCallback, useRef, useState } from "react";
import { NaturalInput } from "../../components/NaturalInput";
import { GraphViewer } from "../../components/GraphViewer";
import { makeRequestId, type MathResult } from "../../types";
import { parseExpression } from "../../engine/parsing";
import type { GraphAnalysis } from "../../engine/stepEngine/graphing";
import { addHistoryEntry } from "../../store/historyDb";

// Modo 6 de la spec v10 §10 (Módulo 7 — el de mayor riesgo del proyecto,
// según la propia spec). Ver README del Módulo 7 sobre el cambio de
// enfoque: todo el análisis es numérico (muestreo + diferencias finitas),
// no un híbrido simbólico-primero. Por eso TODO resultado aquí se marca
// "aproximado", visible en la UI, nunca presentado como exacto.

export function GraphingMode() {
  const [latex, setLatex] = useState("");
  const [view, setView] = useState<[number, number]>([-10, 10]);
  const [appliedView, setAppliedView] = useState<[number, number]>([-10, 10]);
  const [result, setResult] = useState<MathResult | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const handleGraph = useCallback(() => {
    setError(null);
    setResult(null);
    const requestId = makeRequestId();
    let parsed;
    try {
      parsed = parseExpression(latex);
    } catch (err) {
      setError((err as { message?: string }).message ?? "Expresión inválida.");
      return;
    }
    if (parsed.freeVariables.length !== 1) {
      setError("La expresión debe tener exactamente una variable (ej. x).");
      return;
    }
    // Bug detectado en revisión: si "desde" y "hasta" son iguales, GraphViewer
    // divide entre cero al escalar coordenadas (xMax-xMin=0) y la curva
    // desaparece sin ningún error visible. Se valida antes de llegar ahí.
    if (view[0] === view[1]) {
      setError('"Desde" y "hasta" no pueden ser el mismo valor — la ventana de la gráfica necesita un rango.');
      return;
    }
    // Si están invertidos ("desde" > "hasta"), no es un crash, pero produce
    // un dibujo reflejado y confuso — se normaliza en vez de graficar así.
    const normalizedView: [number, number] = view[0] < view[1] ? view : [view[1], view[0]];
    const worker = getWorker();
    worker.onmessage = (e: MessageEvent<MathResult>) => {
      if (!e.data.success) {
        setError(e.data.errorMessage ?? "No se pudo graficar.");
      } else {
        setResult(e.data);
        addHistoryEntry({ mode: "Graficación", input: latex, resultSummary: e.data.resultLatex ?? "" });
      }
    };
    worker.postMessage({
      type: "graph",
      requestId,
      expressionAlgebrite: parsed.algebrite,
      variable: parsed.freeVariables[0],
      view: normalizedView,
    });
    setAppliedView(normalizedView);
  }, [latex, view, getWorker]);

  const analysis = result?.graphAnalysis as GraphAnalysis | undefined;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-4">
      <NaturalInput value={latex} onChange={setLatex} placeholder="f(x), ej. x^2-4" />

      <div className="flex items-center justify-center gap-2 text-sm text-slate-300">
        <span>Vista:</span>
        <input
          type="number"
          value={view[0]}
          onChange={(e) => setView([Number(e.target.value), view[1]])}
          className="w-16 rounded bg-panel px-2 py-1 text-center text-slate-100"
        />
        <span>a</span>
        <input
          type="number"
          value={view[1]}
          onChange={(e) => setView([view[0], Number(e.target.value)])}
          className="w-16 rounded bg-panel px-2 py-1 text-center text-slate-100"
        />
      </div>

      <button
        onClick={handleGraph}
        className="rounded-lg bg-accent py-2 text-lg font-semibold text-white hover:bg-accentSoft"
      >
        Graficar
      </button>

      {error && (
        <div className="rounded-xl bg-panel p-4 text-red-400">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {analysis && (
        <>
          <p className="inline-block rounded bg-amber-900/40 px-2 py-1 text-xs text-amber-300">
            Análisis aproximado por muestreo numérico, no simbólico exacto.
          </p>
          <GraphViewer analysis={analysis} view={appliedView} />
          <div className="flex flex-col gap-1 rounded-xl bg-panel p-4 text-sm text-slate-200">
            <p><span className="text-slate-400">Dominio:</span> {analysis.domainDescription}</p>
            <p><span className="text-slate-400">Rango:</span> {analysis.rangeDescription}</p>
            <p>
              <span className="text-slate-400">Intercepciones en x:</span>{" "}
              {analysis.xIntercepts.length ? analysis.xIntercepts.map((x) => x.toFixed(3)).join(", ") : "ninguna en la vista actual"}
            </p>
            <p>
              <span className="text-slate-400">Intercepción en y:</span>{" "}
              {analysis.yIntercept !== null ? analysis.yIntercept.toFixed(3) : "no definida en x=0"}
            </p>
            <p>
              <span className="text-slate-400">Máximo global:</span>{" "}
              {analysis.globalMax ? `(${analysis.globalMax.x.toFixed(3)}, ${analysis.globalMax.y.toFixed(3)})` : "—"}
            </p>
            <p>
              <span className="text-slate-400">Mínimo global:</span>{" "}
              {analysis.globalMin ? `(${analysis.globalMin.x.toFixed(3)}, ${analysis.globalMin.y.toFixed(3)})` : "—"}
            </p>
            <p>
              <span className="text-slate-400">Máximos locales:</span>{" "}
              {analysis.localMaxima.length ? analysis.localMaxima.map((p) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join("; ") : "ninguno detectado"}
            </p>
            <p>
              <span className="text-slate-400">Mínimos locales:</span>{" "}
              {analysis.localMinima.length ? analysis.localMinima.map((p) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join("; ") : "ninguno detectado"}
            </p>
            <p>
              <span className="text-slate-400">Puntos de inflexión:</span>{" "}
              {analysis.inflectionPoints.length ? analysis.inflectionPoints.map((p) => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join("; ") : "ninguno detectado"}
            </p>
            <p>
              <span className="text-slate-400">Vértice:</span>{" "}
              {analysis.vertex ? `(${analysis.vertex.x.toFixed(3)}, ${analysis.vertex.y.toFixed(3)}) — detectado como posible cuadrática` : "no aplica (no se detectó una parábola)"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
