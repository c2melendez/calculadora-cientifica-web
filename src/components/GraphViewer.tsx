import type { GraphAnalysis } from "../engine/stepEngine/graphing";

// GraphViewer — spec v10 §10. Renderiza en SVG puro a partir de los puntos
// ya muestreados por `analyzeGraph()`, en vez de usar function-plot: evita
// añadir otra dependencia externa no verificada en este entorno sin red
// (ver README, Módulo 7, "cambio de enfoque declarado").

const WIDTH = 340;
const HEIGHT = 280;
const PADDING = 24;

interface GraphViewerProps {
  analysis: GraphAnalysis;
  view: [number, number];
}

export function GraphViewer({ analysis, view }: GraphViewerProps) {
  const [xMin, xMax] = view;
  const ys = analysis.samples.map((p) => p.y);
  const yMin = Math.min(...ys, -1);
  const yMax = Math.max(...ys, 1);

  const toScreenX = (x: number) => PADDING + ((x - xMin) / (xMax - xMin)) * (WIDTH - 2 * PADDING);
  const toScreenY = (y: number) => HEIGHT - PADDING - ((y - yMin) / (yMax - yMin)) * (HEIGHT - 2 * PADDING);

  const pathD = analysis.samples
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toScreenX(p.x).toFixed(1)} ${toScreenY(p.y).toFixed(1)}`)
    .join(" ");

  const axisXScreen = toScreenY(0);
  const axisYScreen = toScreenX(0);

  return (
    <div className="rounded-xl bg-panel p-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        {/* Ejes */}
        {yMin <= 0 && yMax >= 0 && (
          <line x1={PADDING} y1={axisXScreen} x2={WIDTH - PADDING} y2={axisXScreen} stroke="#475569" strokeWidth={1} />
        )}
        {xMin <= 0 && xMax >= 0 && (
          <line x1={axisYScreen} y1={PADDING} x2={axisYScreen} y2={HEIGHT - PADDING} stroke="#475569" strokeWidth={1} />
        )}

        {/* Curva */}
        <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2} />

        {/* Intercepciones en x */}
        {analysis.xIntercepts.map((x, i) => (
          <circle key={`xi-${i}`} cx={toScreenX(x)} cy={toScreenY(0)} r={3} fill="#22c55e" />
        ))}

        {/* Intercepción en y */}
        {analysis.yIntercept !== null && (
          <circle cx={toScreenX(0)} cy={toScreenY(analysis.yIntercept)} r={3} fill="#22c55e" />
        )}

        {/* Máximos/mínimos locales */}
        {analysis.localMaxima.map((p, i) => (
          <circle key={`max-${i}`} cx={toScreenX(p.x)} cy={toScreenY(p.y)} r={4} fill="#f59e0b" />
        ))}
        {analysis.localMinima.map((p, i) => (
          <circle key={`min-${i}`} cx={toScreenX(p.x)} cy={toScreenY(p.y)} r={4} fill="#f97316" />
        ))}

        {/* Inflexión */}
        {analysis.inflectionPoints.map((p, i) => (
          <rect
            key={`inf-${i}`}
            x={toScreenX(p.x) - 3}
            y={toScreenY(p.y) - 3}
            width={6}
            height={6}
            fill="#a855f7"
          />
        ))}

        {/* Vértice (si se detectó cuadrática) */}
        {analysis.vertex && (
          <circle cx={toScreenX(analysis.vertex.x)} cy={toScreenY(analysis.vertex.y)} r={5} fill="#ef4444" />
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-400">
        <span><span className="inline-block h-2 w-2 rounded-full bg-green-500" /> intercepciones</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> máximo local</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-orange-500" /> mínimo local</span>
        <span><span className="inline-block h-2 w-2 bg-purple-500" /> inflexión</span>
        <span><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> vértice</span>
      </div>
    </div>
  );
}
