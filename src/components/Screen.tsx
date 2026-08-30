import { NaturalInput } from "./NaturalInput";
import { ResultPanel } from "./ResultPanel";
import { HistoryLog, type SessionHistoryEntry } from "./HistoryLog";
import { AngleModePopover } from "./AngleModePopover";
import type { MathResult } from "../types";

// Fase E (spec UX estilo ClassCalc — mockup confirmado con el usuario):
// fusiona lo que antes eran 3 tarjetas independientes (HistoryLog,
// NaturalInput, ResultPanel, cada una con su propio bg/rounded/shadow) en
// un solo contenedor "pantalla", como una calculadora física: historial
// atenuado arriba, línea activa grande, resultado alineado a la derecha
// pegado a su expresión. El badge DEG/RAD entra en la esquina de la
// pantalla en vez de flotar en el header del modo.
//
// No reemplaza HistoryLog/ResultPanel — los envuelve. Cada uno sigue
// siendo su propio archivo/responsabilidad, solo que ahora ninguno trae
// fondo propio (ver Fase E en cada uno) para que la fusión visual
// funcione sin bordes duplicados.

type MathFieldRef = { insert: (s: string) => void; focus: () => void; value: string } | null;

interface ScreenProps {
  latex: string;
  onChangeLatex: (latex: string) => void;
  placeholder?: string;
  fieldRef: (el: MathFieldRef) => void;
  result: MathResult | null;
  sessionHistory: SessionHistoryEntry[];
  angleMode: "RAD" | "GRAD";
  onToggleAngleMode: () => void;
}

export function Screen({
  latex,
  onChangeLatex,
  placeholder,
  fieldRef,
  result,
  sessionHistory,
  angleMode,
  onToggleAngleMode,
}: ScreenProps) {
  return (
    <div className="rounded-xl bg-paper-soft px-4 py-3 shadow-inner shadow-black/10">
      <div className="mb-1.5 flex justify-end">
        <AngleModePopover angleMode={angleMode} onToggle={onToggleAngleMode} variant="paper" />
      </div>

      {sessionHistory.length > 0 && (
        <div className="mb-2 max-h-28 overflow-y-auto border-b border-paper-line pb-2">
          <HistoryLog entries={sessionHistory} />
        </div>
      )}

      <NaturalInput value={latex} onChange={onChangeLatex} placeholder={placeholder} fieldRef={fieldRef} bare />
      <ResultPanel result={result} />
    </div>
  );
}
