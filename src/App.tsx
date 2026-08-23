import { useState } from "react";
import { BasicScientificMode } from "./modes/BasicScientific/BasicScientificMode";
import { AlgebraMode } from "./modes/Algebra/AlgebraMode";
import { CalculusMode } from "./modes/Calculus/CalculusMode";
import { LinearSystemsMode } from "./modes/LinearSystems/LinearSystemsMode";
import { MatrixMode } from "./modes/Matrices/MatrixMode";
import { GraphingMode } from "./modes/Graphing/GraphingMode";
import { HistoryPanel } from "./components/HistoryPanel";

// Selector de modos por pestañas. Módulo 8: historial persistente
// (IndexedDB) añadido como séptima pestaña, más ajustes responsive
// (safe-area para notch/barra de gestos en móvil, spec v10 §12).

type Mode = "basic" | "algebra" | "calculus" | "systems" | "matrices" | "graphing" | "history";

const MODE_LABELS: Record<Mode, string> = {
  basic: "Científica",
  algebra: "Álgebra",
  calculus: "Cálculo",
  systems: "Sistemas",
  matrices: "Matrices",
  graphing: "Graficación",
  history: "Historial",
};

export default function App() {
  const [mode, setMode] = useState<Mode>("basic");

  return (
    <div className="min-h-screen bg-surface pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="border-b border-slate-800 p-4 text-center text-lg font-semibold text-slate-100">
        Calculadora Científica
      </header>
      <nav className="flex flex-wrap justify-center gap-3 border-b border-slate-800 bg-panel/50 px-2 py-2 text-sm">
        {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={
              m === mode
                ? "font-semibold text-accent underline"
                : "text-slate-400 hover:text-slate-100"
            }
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </nav>
      {mode === "basic" && <BasicScientificMode />}
      {mode === "algebra" && <AlgebraMode />}
      {mode === "calculus" && <CalculusMode />}
      {mode === "systems" && <LinearSystemsMode />}
      {mode === "matrices" && <MatrixMode />}
      {mode === "graphing" && <GraphingMode />}
      {mode === "history" && <HistoryPanel />}
    </div>
  );
}
