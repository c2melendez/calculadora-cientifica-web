import { KeyGlyph, BOX } from "./KeyGlyph";

// Fase B (spec UX §5): teclado reducido para el modo Basic — sin trig,
// log, ni cálculo. Mismo mecanismo de inserción que MathKeyboard
// (field.insert() cursor-aware), pero con el set de teclas mínimo.

type MathField = { insert: (s: string) => void; focus: () => void } | null;

interface SimpleKeyboardProps {
  field: MathField;
  onBackspace: () => void;
  onEnter: () => void;
  onHistoryBack: () => void;
  onHistoryForward: () => void;
}

const ROWS: { label: React.ReactNode; insert?: string; action?: "backspace" | "enter" | "back" | "forward" }[][] = [
  [
    { label: "←", action: "back" },
    { label: "→", action: "forward" },
    { label: "(", insert: "(" },
    { label: ")", insert: ")" },
  ],
  [
    { label: "%", insert: "\\%" },
    { label: <KeyGlyph glyph={{ sup: "2", base: BOX }} />, insert: "#0^2" },
    { label: <KeyGlyph glyph={{ sqrt: BOX }} />, insert: "\\sqrt{#0}" },
    { label: "⌫", action: "backspace" },
  ],
  [
    { label: "7", insert: "7" },
    { label: "8", insert: "8" },
    { label: "9", insert: "9" },
    { label: "÷", insert: "\\div" },
  ],
  [
    { label: "4", insert: "4" },
    { label: "5", insert: "5" },
    { label: "6", insert: "6" },
    { label: "×", insert: "\\times" },
  ],
  [
    { label: "1", insert: "1" },
    { label: "2", insert: "2" },
    { label: "3", insert: "3" },
    { label: "−", insert: "-" },
  ],
  [
    { label: "0", insert: "0" },
    { label: ".", insert: "." },
    { label: "+", insert: "+" },
    { label: "⏎", action: "enter" },
  ],
];

export function SimpleKeyboard({ field, onBackspace, onEnter, onHistoryBack, onHistoryForward }: SimpleKeyboardProps) {
  function press(cell: (typeof ROWS)[number][number]) {
    if (cell.action === "backspace") return onBackspace();
    if (cell.action === "enter") return onEnter();
    if (cell.action === "back") return onHistoryBack();
    if (cell.action === "forward") return onHistoryForward();
    field?.focus();
    if (cell.insert) field?.insert(cell.insert);
  }

  return (
    <div className="rounded-xl bg-chrome p-3">
      {ROWS.map((row, i) => (
        <div key={i} className="mb-1.5 grid grid-cols-4 gap-1.5 last:mb-0">
          {row.map((cell, j) => (
            <button
              key={j}
              onClick={() => press(cell)}
              className={
                cell.action === "enter"
                  ? "rounded-md bg-graph py-2.5 text-base font-semibold text-paper hover:bg-graph/90"
                  : /^[0-9.]$/.test(String(cell.label))
                    ? "rounded-md bg-chrome-soft/80 py-2.5 text-base font-medium text-bone hover:bg-chrome-soft/60"
                    : "rounded-md bg-chrome-soft py-2.5 text-sm text-bone hover:bg-chrome-soft/70"
              }
            >
              {cell.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
