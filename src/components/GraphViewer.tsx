import type { GraphAnalysis } from "../engine/stepEngine/graphing";

// GraphViewer — spec v10 §10. Renderiza en SVG puro a partir de los puntos
// ya muestreados por `analyzeGraph()`, en vez de usar function-plot: evita
// añadir otra dependencia externa no verificada en este entorno sin red
// (ver README, Módulo 7, "cambio de enfoque declarado").
//
// Fase D (spec UX estilo ClassCalc §6): ahora dibuja VARIAS curvas
// superpuestas (antes solo una) — layout Desmos, cada expresión de la
// lista tiene su propio color. Las anotaciones ricas (intercepciones,
// extremos, inflexión, vértice) solo se muestran para la curva
// "seleccionada" — mostrarlas todas a la vez para cada curva sería
// ilegible con más de una expresión activa, igual que hace Desmos.

export interface GraphCurve {
  id: string;
  color: string;
  analysis: GraphAnalysis;
}

const WIDTH = 340;
const HEIGHT = 280;
const PADDING = 24;

interface GraphViewerProps {
  curves: GraphCurve[];
  selectedId: string | null;
  view: [number, number];
}

export function GraphViewer({ curves, selectedId, view }: GraphViewerProps) {
  const [xMin, xMax] = view;
  const allYs = curves.flatMap((c) => c.analysis.samples.map((p) => p.y));
  const yMin = Math.min(...allYs, -1);
  const yMax = Math.max(...allYs, 1);

  const toScreenX = (x: number) => PADDING + ((x - xMin) / (xMax - xMin)) * (WIDTH - 2 * PADDING);
  const toScreenY = (y: number) => HEIGHT - PADDING - ((y - yMin) / (yMax - yMin)) * (HEIGHT - 2 * PADDING);

  const axisXScreen = toScreenY(0);
  const axisYScreen = toScreenX(0);
  const selected = curves.find((c) => c.id === selectedId) ?? curves[0];

  return (
    <div className="rounded-xl bg-chrome p-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        {yMin <= 0 && yMax >= 0 && (
          <line x1={PADDING} y1={axisXScreen} x2={WIDTH - PADDING} y2={axisXScreen} stroke="#475569" strokeWidth={1} />
        )}
        {xMin <= 0 && xMax >= 0 && (
          <line x1={axisYScreen} y1={PADDING} x2={axisYScreen} y2={HEIGHT - PADDING} stroke="#475569" strokeWidth={1} />
        )}

        {curves.map((curve) => {
          const pathD = curve.analysis.samples
            .map((p, i) => `${i === 0 ? "M" : "L"} ${toScreenX(p.x).toFixed(1)} ${toScreenY(p.y).toFixed(1)}`)
            .join(" ");
          return (
            <path
              key={curve.id}
              d={pathD}
              fill="none"
              stroke={curve.color}
              strokeWidth={curve.id === selected?.id ? 2.5 : 1.5}
              opacity={curve.id === selected?.id ? 1 : 0.55}
            />
          );
        })}

        {selected && (
          <>
            {selected.analysis.xIntercepts.map((x, i) => (
              <circle key={`xi-${i}`} cx={toScreenX(x)} cy={toScreenY(0)} r={3} fill="#22c55e" />
            ))}
            {selected.analysis.yIntercept !== null && (
              <circle cx={toScreenX(0)} cy={toScreenY(selected.analysis.yIntercept)} r={3} fill="#22c55e" />
            )}
            {selected.analysis.localMaxima.map((p, i) => (
              <circle key={`max-${i}`} cx={toScreenX(p.x)} cy={toScreenY(p.y)} r={4} fill="#f59e0b" />
            ))}
            {selected.analysis.localMinima.map((p, i) => (
              <circle key={`min-${i}`} cx={toScreenX(p.x)} cy={toScreenY(p.y)} r={4} fill="#f97316" />
            ))}
            {selected.analysis.inflectionPoints.map((p, i) => (
              <rect key={`inf-${i}`} x={toScreenX(p.x) - 3} y={toScreenY(p.y) - 3} width={6} height={6} fill="#a855f7" />
            ))}
            {selected.analysis.vertex && (
              <circle cx={toScreenX(selected.analysis.vertex.x)} cy={toScreenY(selected.analysis.vertex.y)} r={5} fill="#ef4444" />
            )}
          </>
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-bone/60">
        <span><span className="inline-block h-2 w-2 rounded-full bg-green-500" /> intercepciones</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> máximo local</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-orange-500" /> mínimo local</span>
        <span><span className="inline-block h-2 w-2 bg-purple-500" /> inflexión</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> vértice</span>
        <span className="text-bone/40">(anotaciones solo de la curva seleccionada)</span>
      </div>
    </div>
  );
}
