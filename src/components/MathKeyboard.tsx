import { useState } from "react";

// Teclado convencional de calculadora científica — spec v10 §5, replica la
// estructura de pestañas de las imágenes de referencia (ppal/abc/fnc).

type Tab = "ppal" | "abc" | "fnc";

interface MathKeyboardProps {
  onInsert: (latex: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onEnter: () => void;
  angleMode: "RAD" | "GRAD";
  onToggleAngleMode: () => void;
  showAngleToggle?: boolean;
}

const PPAL_KEYS: Array<{ label: string; latex: string }> = [
  { label: "x²", latex: "^2" },
  { label: "xʸ", latex: "^{}" },
  { label: "|x|", latex: "\\left|\\right|" },
  { label: "√", latex: "\\sqrt{}" },
  { label: "ⁿ√", latex: "\\sqrt[n]{}" },
  { label: "π", latex: "\\pi" },
  { label: "sin", latex: "\\sin()" },
  { label: "cos", latex: "\\cos()" },
  { label: "tan", latex: "\\tan()" },
];

const FNC_KEYS: Array<{ label: string; latex: string }> = [
  { label: "sin⁻¹", latex: "\\sin^{-1}()" },
  { label: "cos⁻¹", latex: "\\cos^{-1}()" },
  { label: "tan⁻¹", latex: "\\tan^{-1}()" },
  { label: "eˣ", latex: "e^{}" },
  { label: "ln", latex: "\\ln()" },
  { label: "log", latex: "\\log()" },
  { label: "e", latex: "e" },
  { label: "n!", latex: "!" },
  { label: "abs", latex: "\\left|\\right|" },
];

const DIGIT_KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", "."];

export function MathKeyboard({
  onInsert,
  onBackspace,
  onClear,
  onEnter,
  angleMode,
  onToggleAngleMode,
  showAngleToggle = true,
}: MathKeyboardProps) {
  const [tab, setTab] = useState<Tab>("ppal");

  return (
    <div className="rounded-xl bg-keypad p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-4 text-sm font-medium text-slate-300">
          {(["ppal", "abc", "fnc"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={t === tab ? "text-accent underline" : "hover:text-slate-100"}
            >
              {t}
            </button>
          ))}
        </div>
        {showAngleToggle && (
          <button
            onClick={onToggleAngleMode}
            className="rounded bg-panel px-2 py-1 text-xs font-semibold text-accent"
          >
            {angleMode}
          </button>
        )}
      </div>

      {tab === "ppal" && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {PPAL_KEYS.map((k) => (
            <KeyButton key={k.label} label={k.label} onClick={() => onInsert(k.latex)} />
          ))}
        </div>
      )}
      {tab === "fnc" && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {FNC_KEYS.map((k) => (
            <KeyButton key={k.label} label={k.label} onClick={() => onInsert(k.latex)} />
          ))}
        </div>
      )}
      {tab === "abc" && (
        <div className="mb-2 grid grid-cols-7 gap-2">
          {"qwertyuiopasdfghjklzxcvbnm".split("").map((c) => (
            <KeyButton key={c} label={c} onClick={() => onInsert(c)} />
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {DIGIT_KEYS.map((d) => (
          <KeyButton key={d} label={d} onClick={() => onInsert(d)} />
        ))}
        {["÷", "×", "−", "+"].map((op, i) => (
          <KeyButton
            key={op}
            label={op}
            onClick={() => onInsert(["\\div", "\\times", "-", "+"][i])}
          />
        ))}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2">
        <KeyButton label="(" onClick={() => onInsert("(")} />
        <KeyButton label=")" onClick={() => onInsert(")")} />
        <KeyButton label="⌫" onClick={onBackspace} />
        <KeyButton label="borrar todo" onClick={onClear} muted />
      </div>

      <button
        onClick={onEnter}
        className="mt-2 w-full rounded-lg bg-accent py-2 text-lg font-semibold text-white hover:bg-accentSoft"
      >
        ⏎ Calcular
      </button>
    </div>
  );
}

function KeyButton({
  label,
  onClick,
  muted,
}: {
  label: string;
  onClick: () => void;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg py-2 text-lg ${
        muted ? "bg-transparent text-slate-500 hover:text-slate-300" : "bg-panel text-slate-100 hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
