import { useState } from "react";
import { BasicScientificMode } from "./modes/BasicScientific/BasicScientificMode";
import { SimpleBasicMode } from "./modes/SimpleBasic/SimpleBasicMode";
import { AlgebraMode } from "./modes/Algebra/AlgebraMode";
import { CalculusMode } from "./modes/Calculus/CalculusMode";
import { LinearSystemsMode } from "./modes/LinearSystems/LinearSystemsMode";
import { MatrixMode } from "./modes/Matrices/MatrixMode";
import { GraphingMode } from "./modes/Graphing/GraphingMode";
import { StatisticsMode } from "./modes/Statistics/StatisticsMode";
import { UnitsMode } from "./modes/Units/UnitsMode";
import { HistoryPanel } from "./components/HistoryPanel";
import { HistoryDrawer } from "./components/HistoryDrawer";
import { ThemeToggle } from "./components/ThemeToggle";

// Selector de modos por pestañas tipo "chasis" (Fase 1 — sistema de diseño
// Precision Lab). Historial persistente (IndexedDB) como séptima pestaña,
// más ajustes responsive (safe-area para notch/barra de gestos en móvil).
//
// Fase B (spec UX estilo ClassCalc): se agregó "simple" (modo Basic, 4
// operaciones) como pestaña adicional — sin fusionar Álgebra/Cálculo/
// Sistemas dentro de Científica ni cambiar a un dropdown de 4 modos
// todavía (decisión explícita: se pospone hasta que el ícono "sistema"
// del teclado de Científica tenga lógica real de resolución).

type Mode = "basic" | "simple" | "algebra" | "calculus" | "systems" | "matrices" | "graphing" | "statistics" | "units" | "history";

const MODE_LABELS: Record<Mode, string> = {
  basic: "Científica",
  simple: "Basic",
  algebra: "Álgebra",
  calculus: "Cálculo",
  systems: "Sistemas",
  matrices: "Matrices",
  graphing: "Gráficas",
  statistics: "Estadística",
  units: "Unidades",
  history: "Historial",
};

// Punto 4 del rediseño de teclado (pedido de Carlos): Álgebra/Cálculo/
// Sistemas ya no deben verse en el frontend — su función quedó cubierta
// por el router de Fase 1/2 dentro de "Científica" (ecuación/sistema/
// derivada/integral/límite, todo en una sola pantalla). Los modos en sí
// NO se eliminan (siguen existiendo, siguen siendo válidos si algo
// interno navega ahí), solo se les quita la pestaña visible.
//
// P2 (spec v2 §3): "history" deja de ser pestaña — pasa a ser el
// HistoryDrawer (botón dedicado en el header, ya no un tab). Se queda
// en `type Mode`/MODE_LABELS por si algo interno todavía lo referencia,
// pero ya no aparece en VISIBLE_MODES.
// P6 (spec v2 §7): "statistics" nueva, visible.
// P7 (spec v2 §8): "units" nueva, visible — con esto queda el orden
// final de §9: Científica · Basic · Matrices · Gráficas · Estadística ·
// Unidades.
const VISIBLE_MODES: Mode[] = ["basic", "simple", "matrices", "graphing", "statistics", "units"];

export default function App() {
  const [mode, setMode] = useState<Mode>("basic");
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <div className="min-h-screen bg-chrome pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between gap-2 border-b border-chrome-soft p-4">
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          aria-label="Historial"
          aria-expanded={historyOpen}
          className="flex w-[92px] items-center gap-1.5 rounded-md px-2 py-1.5 text-bone/80 hover:bg-chrome-soft hover:text-bone dt:w-[140px]"
        >
          <span aria-hidden="true">▤</span>
          <span className="text-xs">Historial</span>
        </button>
        <span className="font-display text-lg font-medium tracking-tight text-bone">
          Precision Lab <span className="text-marker">Lite</span>
        </span>
        <ThemeToggle />
      </header>
      <nav className="flex flex-wrap justify-center gap-1.5 border-b border-chrome-soft bg-chrome px-2 py-2 text-sm lg:gap-2 lg:py-2.5 dt:gap-3">
        {(VISIBLE_MODES).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-current={m === mode ? "page" : undefined}
            className={
              m === mode
                ? "rounded-md border-b-2 border-marker bg-marker-soft px-3 py-1.5 font-medium text-marker-text"
                : "rounded-md border-b-2 border-transparent px-3 py-1.5 text-bone/70 hover:bg-chrome-soft hover:text-bone"
            }
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </nav>
      <div className="flex">
        <main className="min-w-0 flex-1 bg-paper text-ink">
          {mode === "basic" && <BasicScientificMode />}
          {mode === "simple" && <SimpleBasicMode />}
          {mode === "algebra" && <AlgebraMode />}
          {mode === "calculus" && <CalculusMode />}
          {mode === "systems" && <LinearSystemsMode />}
          {mode === "matrices" && <MatrixMode />}
          {mode === "graphing" && <GraphingMode />}
          {mode === "statistics" && <StatisticsMode />}
          {mode === "units" && <UnitsMode />}
        </main>
        <HistoryDrawer isOpen={historyOpen} onClose={() => setHistoryOpen(false)}>
          <HistoryPanel />
        </HistoryDrawer>
      </div>
    </div>
  );
}
