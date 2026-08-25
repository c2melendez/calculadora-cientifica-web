import { useState } from "react";

// Teclado denso tipo Casio (Fase 1 — sistema de diseño Precision Lab).
// Reemplaza el teclado de pestañas (ppal/abc/fnc) por capas SHIFT/ALPHA
// "de un solo disparo": se activan, se aplican a la siguiente tecla
// presionada, y se desactivan solas (igual que una calculadora física).
// Misma API pública que la versión anterior — es un reemplazo directo.

interface MathKeyboardProps {
  onInsert: (latex: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onEnter: () => void;
  angleMode: "RAD" | "GRAD";
  onToggleAngleMode: () => void;
  showAngleToggle?: boolean;
}

interface KeyDef {
  label: string;
  latex: string;
  shiftLabel?: string;
  shiftLatex?: string;
  alphaLabel?: string;
  alphaLatex?: string;
}

const STRUCT_ROW: KeyDef[] = [
  { label: "(", latex: "(", alphaLabel: "|x|", alphaLatex: "\\left|\\right|" },
  { label: ")", latex: ")", alphaLabel: "n!", alphaLatex: "!" },
  { label: "x²", latex: "^2", shiftLabel: "√", shiftLatex: "\\sqrt{}" },
  { label: "xʸ", latex: "^{}", shiftLabel: "ⁿ√", shiftLatex: "\\sqrt[n]{}", alphaLabel: "φ", alphaLatex: "phi" },
  { label: "π", latex: "\\pi", shiftLabel: "e", shiftLatex: "e", alphaLabel: "τ", alphaLatex: "tau" },
];

const TRIG_ROW: KeyDef[] = [
  { label: "sin", latex: "\\sin()", shiftLabel: "sin⁻¹", shiftLatex: "\\sin^{-1}()", alphaLabel: "x", alphaLatex: "x" },
  { label: "cos", latex: "\\cos()", shiftLabel: "cos⁻¹", shiftLatex: "\\cos^{-1}()", alphaLabel: "y", alphaLatex: "y" },
  { label: "tan", latex: "\\tan()", shiftLabel: "tan⁻¹", shiftLatex: "\\tan^{-1}()", alphaLabel: "z", alphaLatex: "z" },
  { label: "ln", latex: "\\ln()", shiftLabel: "eˣ", shiftLatex: "e^{}", alphaLabel: "n", alphaLatex: "n" },
  { label: "log", latex: "\\log()", shiftLabel: "10ˣ", shiftLatex: "10^{}", alphaLabel: "t", alphaLatex: "t" },
];

/**
 * Fase 3 ("motor científico completo"): hiperbólicas + exp/sign, y nPr/nCr
 * en SHIFT (comparten fila con exp/sign por espacio — no encajaban en
 * TRIG_ROW, que ya tenía sus 5 teclas ocupadas). Ver
 * engine/parsing/postfixOperators.ts y constants.ts para el soporte real.
 */
const HYP_ROW: KeyDef[] = [
  { label: "sinh", latex: "sinh()", shiftLabel: "sinh⁻¹", shiftLatex: "asinh()" },
  { label: "cosh", latex: "cosh()", shiftLabel: "cosh⁻¹", shiftLatex: "acosh()" },
  { label: "tanh", latex: "tanh()", shiftLabel: "tanh⁻¹", shiftLatex: "atanh()" },
  { label: "exp", latex: "exp()", shiftLabel: "nPr", shiftLatex: "nPr(,)" },
  { label: "sign", latex: "sign()", shiftLabel: "nCr", shiftLatex: "nCr(,)" },
];

export function MathKeyboard({
  onInsert,
  onBackspace,
  onClear,
  onEnter,
  angleMode,
  onToggleAngleMode,
  showAngleToggle = true,
}: MathKeyboardProps) {
  const [modifier, setModifier] = useState<"shift" | "alpha" | null>(null);

  function press(key: KeyDef) {
    if (modifier === "shift" && key.shiftLatex) onInsert(key.shiftLatex);
    else if (modifier === "alpha" && key.alphaLatex) onInsert(key.alphaLatex);
    else onInsert(key.latex);
    setModifier(null);
  }

  function toggle(m: "shift" | "alpha") {
    setModifier((cur) => (cur === m ? null : m));
  }

  return (
    <div className="rounded-xl bg-chrome p-3">
      {/* Fila de control: SHIFT / ALPHA / navegación / modo de ángulo */}
      <div className="mb-1.5 grid grid-cols-5 gap-1.5">
        <ModKey label="SHIFT" active={modifier === "shift"} tone="marker" onClick={() => toggle("shift")} />
        <ModKey label="ALPHA" active={modifier === "alpha"} tone="alpha" onClick={() => toggle("alpha")} />
        <Key label="←" onClick={() => onInsert("\\left")} />
        <Key label="→" onClick={() => onInsert("\\right")} />
        {showAngleToggle ? (
          <ModKey label={angleMode} active={false} tone="graph" onClick={onToggleAngleMode} />
        ) : (
          <span />
        )}
      </div>

      {/* Filas estructurales: cada tecla puede mostrar su etiqueta SHIFT/ALPHA arriba */}
      <KeyRow keys={STRUCT_ROW} modifier={modifier} onPress={press} />
      <KeyRow keys={TRIG_ROW} modifier={modifier} onPress={press} />
      <KeyRow keys={HYP_ROW} modifier={modifier} onPress={press} />

      {/* Bloque numérico + operadores, igual que una calculadora física */}
      <div className="mb-1.5 grid grid-cols-5 gap-1.5">
        <DigitKey label="7" onClick={() => onInsert("7")} />
        <DigitKey label="8" onClick={() => onInsert("8")} />
        <DigitKey label="9" onClick={() => onInsert("9")} />
        <Key label="DEL" small onClick={onBackspace} />
        <Key label="AC" small tone="marker" onClick={onClear} />
      </div>
      <div className="mb-1.5 grid grid-cols-5 gap-1.5">
        <DigitKey label="4" onClick={() => onInsert("4")} />
        <DigitKey label="5" onClick={() => onInsert("5")} />
        <DigitKey label="6" onClick={() => onInsert("6")} />
        <Key label="×" onClick={() => onInsert("\\times")} />
        <Key label="÷" onClick={() => onInsert("\\div")} />
      </div>
      <div className="mb-1.5 grid grid-cols-5 gap-1.5">
        <DigitKey label="1" onClick={() => onInsert("1")} />
        <DigitKey label="2" onClick={() => onInsert("2")} />
        <DigitKey label="3" onClick={() => onInsert("3")} />
        <Key label="+" onClick={() => onInsert("+")} />
        <Key label="−" onClick={() => onInsert("-")} />
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        <DigitKey label="0" onClick={() => onInsert("0")} />
        <DigitKey label="." onClick={() => onInsert(".")} />
        <Key label="%" small onClick={() => onInsert("%")} />
        <Key label="Ans" small onClick={() => onInsert("\\text{Ans}")} />
        <Key label="=" tone="graph" onClick={onEnter} />
      </div>
    </div>
  );
}

function KeyRow({
  keys,
  modifier,
  onPress,
}: {
  keys: KeyDef[];
  modifier: "shift" | "alpha" | null;
  onPress: (key: KeyDef) => void;
}) {
  return (
    <div className="mb-1.5 grid grid-cols-5 gap-1.5">
      {keys.map((k) => {
        const subLabel = modifier === "shift" ? k.shiftLabel : modifier === "alpha" ? k.alphaLabel : undefined;
        return (
          <div key={k.label} className="text-center">
            <div
              className={`mb-0.5 h-2.5 text-[8px] leading-none ${
                subLabel ? (modifier === "shift" ? "text-marker" : "text-alpha") : "text-transparent"
              }`}
            >
              {subLabel ?? "·"}
            </div>
            <button
              onClick={() => onPress(k)}
              className="w-full rounded-md bg-chrome-soft py-2 text-sm text-bone hover:bg-chrome-soft/70"
            >
              {k.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function Key({
  label,
  onClick,
  tone,
  small,
}: {
  label: string;
  onClick: () => void;
  tone?: "marker" | "graph";
  small?: boolean;
}) {
  const toneClass =
    tone === "marker" ? "text-marker" : tone === "graph" ? "text-graph" : "text-bone";
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-md bg-chrome-soft py-2 ${small ? "text-xs" : "text-sm"} font-medium hover:bg-chrome-soft/70 ${toneClass}`}
    >
      {label}
    </button>
  );
}

function DigitKey({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-md bg-chrome-soft/80 py-2 text-base font-medium text-bone hover:bg-chrome-soft/60"
    >
      {label}
    </button>
  );
}

function ModKey({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: "marker" | "alpha" | "graph";
  onClick: () => void;
}) {
  const toneMap = {
    marker: { bg: "bg-marker-soft", text: "text-marker-text", idle: "text-marker" },
    alpha: { bg: "bg-alpha-soft", text: "text-alpha", idle: "text-alpha" },
    graph: { bg: "bg-graph/20", text: "text-graph", idle: "text-graph" },
  }[tone];
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-md py-2 text-[11px] font-semibold ${
        active ? `${toneMap.bg} ${toneMap.text}` : `bg-chrome-soft ${toneMap.idle}`
      }`}
    >
      {label}
    </button>
  );
}
