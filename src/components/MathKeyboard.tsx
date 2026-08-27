import { useState } from "react";
import { KeyGlyph, type Glyph, BOX } from "./KeyGlyph";

// Fase A (spec UX estilo ClassCalc) — reemplaza el teclado SHIFT/ALPHA de
// la Fase 1/3 por el patrón real de ClassCalc: rejilla base fija (más
// usados) + pestañas Trig/Alg/Stat/Clcs que abren un menú flotante con
// más funciones, sin ocultar la rejilla base. Inserta con field.insert()
// usando plantillas LaTeX con marcador de posición #0 (igual que
// Precision Lab/Python) — ya no concatenación de texto ingenua.

type MathField = { insert: (s: string) => void; focus: () => void } | null;

interface KeyDef {
  glyph: Glyph;
  insertLatex: string;
  ariaLabel: string;
}

const key = (glyph: Glyph, insertLatex: string, ariaLabel: string): KeyDef => ({ glyph, insertLatex, ariaLabel });

// ---- Rejilla base (spec §3.1) ----
const BASE_GRID: KeyDef[][] = [
  [
    key("log", "\\log\\left(#0\\right)", "logaritmo base 10"),
    key("sin", "\\sin\\left(#0\\right)", "seno"),
    key("π", "\\pi", "pi"),
    key({ frac: ["d", "dx"] }, "\\frac{d}{dx}\\left(#0\\right)", "derivada"),
    key({ sqrt: BOX }, "\\sqrt{#0}", "raíz cuadrada"),
  ],
  [
    key("ln", "\\ln\\left(#0\\right)", "logaritmo natural"),
    key("cos", "\\cos\\left(#0\\right)", "coseno"),
    key("e", "e", "e"),
    key("∫", "\\int #0\\,dx", "integral"),
    key({ frac: [BOX, BOX] }, "\\frac{#0}{#1}", "fracción"),
  ],
  [
    key({ sup: "n", base: "10" }, "10^{#0}", "potencia de 10"),
    key("tan", "\\tan\\left(#0\\right)", "tangente"),
    key({ sup: "2", base: BOX }, "#0^2", "al cuadrado"),
    key({ sup: BOX, base: "x" }, "#0^{#1}", "potencia general"),
    key({ sqrt: BOX, index: "n" }, "\\sqrt[#0]{#1}", "raíz enésima"),
  ],
  [
    key({ italic: "i" }, "i", "número imaginario"),
    key("Lim", "\\lim_{#0}", "límite"),
    key("=", "=", "igual"),
    key("f(x)=0", "#0=0", "resolver ecuación"),
    key("⏎", "", "calcular"),
  ],
];

const NUMPAD: KeyDef[][] = [
  [key("7", "7", "7"), key("8", "8", "8"), key("9", "9", "9"), key("÷", "\\div", "dividir"), key("⌫", "", "borrar")],
  [key("4", "4", "4"), key("5", "5", "5"), key("6", "6", "6"), key("×", "\\times", "multiplicar"), key("(", "(", "paréntesis izquierdo")],
  [key("1", "1", "1"), key("2", "2", "2"), key("3", "3", "3"), key("−", "-", "restar"), key(")", ")", "paréntesis derecho")],
  [key("0", "0", "0"), key(".", ".", "punto"), key("+", "+", "sumar"), key("−", "-", "restar"), key("⏎", "", "calcular")],
];

// ---- Menús flotantes por categoría (spec §3.5) ----
const CATEGORY_MENUS: Record<string, { section: string; keys: KeyDef[] }[]> = {
  Trig: [
    {
      section: "Directas",
      keys: ["sin", "cos", "tan", "csc", "sec", "cot"].map((f) =>
        key(f, `\\${f}\\left(#0\\right)`, f),
      ),
    },
    {
      section: "Inversas",
      keys: ["sin", "cos", "tan", "csc", "sec", "cot"].map((f) =>
        key({ sup: "-1", base: f }, `\\${f}^{-1}\\left(#0\\right)`, `${f} inversa`),
      ),
    },
    {
      section: "Hiperbólicas",
      keys: ["sinh", "cosh", "tanh", "csch", "sech", "coth"].map((f) => key(f, `${f}\\left(#0\\right)`, f)),
    },
  ],
  Alg: [
    {
      section: "Básico",
      keys: [
        key({ sqrt: BOX }, "\\sqrt{#0}", "raíz cuadrada"),
        key({ sqrt: BOX, index: "n" }, "\\sqrt[#0]{#1}", "raíz enésima"),
        key({ sup: "2", base: BOX }, "#0^2", "al cuadrado"),
        key({ sup: BOX, base: BOX }, "#0^{#1}", "potencia"),
        key("e", "e", "e"),
        key("π", "\\pi", "pi"),
      ],
    },
    {
      section: "Avanzado",
      keys: [
        key("log", "\\log\\left(#0\\right)", "logaritmo"),
        key({ sub: BOX, base: "log" }, "\\log_{#0}\\left(#1\\right)", "logaritmo con base"),
        key("ln", "\\ln\\left(#0\\right)", "logaritmo natural"),
        key("mod", "\\mathrm{mod}\\left(#0,#1\\right)", "módulo"),
        key("|a|", "\\left|#0\\right|", "valor absoluto"),
        key("%", "\\%", "porcentaje"),
        key("GCD", "\\gcd\\left(#0,#1\\right)", "máximo común divisor"),
        key("LCM", "\\mathrm{lcm}\\left(#0,#1\\right)", "mínimo común múltiplo"),
      ],
    },
  ],
  Stat: [
    {
      section: "Básico",
      keys: [
        key("mean", "\\mathrm{mean}\\left(#0\\right)", "media"),
        key("median", "\\mathrm{median}\\left(#0\\right)", "mediana"),
        key("mode", "\\mathrm{mode}\\left(#0\\right)", "moda"),
        key("min", "\\min\\left(#0\\right)", "mínimo"),
        key("max", "\\max\\left(#0\\right)", "máximo"),
        key("range", "\\mathrm{range}\\left(#0\\right)", "rango"),
      ],
    },
    {
      // Fase A §8: paridad completa con ClassCalc (agregado sobre el
      // subconjunto básico original).
      section: "Avanzado",
      keys: [
        key("stdev", "\\mathrm{stdev}\\left(#0\\right)", "desviación estándar"),
        key("variance", "\\mathrm{var}\\left(#0\\right)", "varianza"),
        key({ sub: "n", base: "C" }, "\\mathrm{nCr}\\left(#0,#1\\right)", "combinaciones"),
        key({ sub: "n", base: "P" }, "\\mathrm{nPr}\\left(#0,#1\\right)", "permutaciones"),
        key("n!", "#0!", "factorial"),
        key("sort", "\\mathrm{sort}\\left(#0\\right)", "ordenar"),
        key("mad", "\\mathrm{mad}\\left(#0\\right)", "desviación absoluta media"),
      ],
    },
  ],
  Clcs: [
    {
      section: "Continuo",
      keys: [
        key({ frac: ["d", "dx"] }, "\\frac{d}{dx}\\left(#0\\right)", "derivada"),
        key("∫", "\\int #0\\,dx", "integral"),
        key("Lim", "\\lim_{#0}#1", "límite"),
      ],
    },
    {
      section: "Discreto",
      keys: [
        key("Σ", "\\sum_{#0}^{#1}#2", "sumatoria"),
        key({ italic: "x" }, "x", "variable x"),
        key({ italic: "y" }, "y", "variable y"),
      ],
    },
  ],
};

const CATEGORIES = ["Trig", "Alg", "Stat", "Clcs"] as const;

interface MathKeyboardProps {
  field: MathField;
  onBackspace: () => void;
  onEnter: () => void;
  /** Fase A §3.4: los tres íconos de resolución. Si no se pasan, el ícono
   * simplemente inserta la plantilla LaTeX asociada. */
  onSolveEquation?: () => void;
  onSolveSystem?: () => void;
  onSimplify?: () => void;
}

export function MathKeyboard({
  field,
  onBackspace,
  onEnter,
  onSolveEquation,
  onSolveSystem,
  onSimplify,
}: MathKeyboardProps) {
  const [openCategory, setOpenCategory] = useState<(typeof CATEGORIES)[number] | null>(null);

  function press(k: KeyDef) {
    field?.focus();
    if (k.insertLatex) field?.insert(k.insertLatex);
    setOpenCategory(null);
  }

  function pressBase(k: KeyDef) {
    if (k.glyph === "⏎") return onEnter();
    if (k.glyph === "⌫") return onBackspace();
    if (k.glyph === "f(x)=0") return onSolveEquation ? onSolveEquation() : press(k);
    press(k);
  }

  return (
    <div className="relative rounded-xl bg-chrome p-3">
      {openCategory && (
        <div className="absolute bottom-full left-3 right-3 mb-1.5 rounded-lg bg-chrome-soft p-3 shadow-lg">
          {CATEGORY_MENUS[openCategory].map((group) => (
            <div key={group.section} className="mb-2 last:mb-0">
              <div className="mb-1.5 text-[9px] uppercase tracking-wide text-bone/50">{group.section}</div>
              <div className="grid grid-cols-3 gap-1.5">
                {group.keys.map((k, i) => (
                  <button
                    key={`${group.section}-${i}`}
                    onClick={() => press(k)}
                    aria-label={k.ariaLabel}
                    className="rounded-md bg-marker-soft/10 py-2 text-sm text-marker hover:bg-marker-soft/20"
                  >
                    <KeyGlyph glyph={k.glyph} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Íconos de resolución (spec §3.4) */}
      <div className="mb-1.5 grid grid-cols-3 gap-1.5">
        <button
          onClick={onSolveEquation}
          aria-label="Resolver ecuación"
          className="rounded-md bg-marker-soft/15 py-2 text-[11px] font-medium text-marker hover:bg-marker-soft/25"
        >
          f(x)=0
        </button>
        <button
          onClick={onSolveSystem}
          aria-label="Resolver sistema de ecuaciones"
          className="flex items-center justify-center gap-1 rounded-md bg-alpha-soft py-2 text-[10px] font-medium text-alpha hover:bg-alpha-soft/80"
        >
          <span className="text-base font-light">{"{"}</span>
          <span className="text-left leading-tight">
            f(x)=0
            <br />
            g(x)=0
          </span>
        </button>
        <button
          onClick={onSimplify}
          aria-label="Simplificar expresión"
          className="rounded-md bg-graph/15 py-2 text-[11px] font-medium text-graph hover:bg-graph/25"
        >
          a+a → 2a
        </button>
      </div>

      {/* Pestañas de categoría */}
      <div className="mb-1.5 flex gap-3 px-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setOpenCategory((c) => (c === cat ? null : cat))}
            aria-expanded={openCategory === cat}
            className={openCategory === cat ? "text-xs font-semibold text-marker" : "text-xs text-bone/70"}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Rejilla base + numérico */}
      {BASE_GRID.map((row, i) => (
        <div key={i} className="mb-1.5 grid grid-cols-10 gap-1">
          {row.map((k, j) => (
            <button
              key={j}
              onClick={() => pressBase(k)}
              aria-label={k.ariaLabel}
              className="rounded-md bg-chrome-soft py-2 text-[11px] text-bone hover:bg-chrome-soft/70"
            >
              <KeyGlyph glyph={k.glyph} />
            </button>
          ))}
          {NUMPAD[i].map((k, j) => (
            <button
              key={`n${j}`}
              onClick={() => pressBase(k)}
              aria-label={k.ariaLabel}
              className={
                /^[0-9.]$/.test(String(k.glyph))
                  ? "rounded-md bg-chrome-soft/80 py-2 text-sm font-medium text-bone hover:bg-chrome-soft/60"
                  : "rounded-md bg-chrome-soft py-2 text-[11px] text-bone hover:bg-chrome-soft/70"
              }
            >
              <KeyGlyph glyph={k.glyph} />
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
