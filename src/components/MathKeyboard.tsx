import { useState } from "react";
import { KeyGlyph, type Glyph, BOX } from "./KeyGlyph";

// Fase A (spec UX estilo ClassCalc) — reemplaza el teclado SHIFT/ALPHA de
// la Fase 1/3 por el patrón real de ClassCalc: rejilla base fija (más
// usados) + pestañas Trig/Stat que abren un menú flotante con más
// funciones, sin ocultar la rejilla base. Inserta con field.insert()
// usando plantillas LaTeX con marcador de posición #0 (igual que
// Precision Lab/Python) — ya no concatenación de texto ingenua.
//
// Rediseño (pedido de Carlos, con capturas de referencia de ClassCalc):
// - d/dx e ∫ salen de la rejilla base — se mudan a la tira de Cálculo
//   (2 renglones) justo debajo de los 3 íconos de resolución, junto con
//   sus variantes (orden N, límites, integral con límites) que ya
//   estaban resueltas de verdad esta sesión (∫_a^b, d^N/dx^N, límite al
//   infinito, límite lateral — ver normalize.ts/compute.worker.ts).
// - ∬/∭ (integral doble/triple) y sus variantes con límites se quitaron
//   directamente — decisión de Carlos, tras la de dejarlas "solo
//   visuales": ni Algebrite ni SymPy tienen cómputo real detrás, mejor
//   no mostrar una tecla en absoluto que una que solo da un aviso.
// - ∂/∂x (derivada parcial) tampoco tiene cómputo real detrás (motor de
//   una sola variable) — se deja como tecla visual con aviso, igual que
//   antes (no se pidió quitarla).
// - Se quitan las pestañas "Alg"/"Clcs": mod/GCD/LCM se reubican en
//   "Stat" (única pestaña que queda con espacio para ellas); el resto de
//   "Alg" (raíces, potencias, logs) ya vive en la rejilla base.
// - Multiplicación ahora inserta \cdot (punto) en vez de \times, con el
//   mismo glifo visual "·" en la tecla — pedido explícito de Carlos.
// - ÷ ahora inserta directamente la plantilla de fracción, no el símbolo
//   de división — mismo pedido.
// - Se agrega un renglón de operadores relacionales (<, >, ≤, ≥) al pie,
//   útiles para el router de ecuación/desigualdad de Fase 1.

type MathField = { insert: (s: string) => void; focus: () => void } | null;

interface KeyDef {
  glyph: Glyph;
  insertLatex: string;
  ariaLabel: string;
  /** Sin cómputo real detrás todavía (∬/∭/∂) — presionarla muestra un
   * aviso en vez de insertar algo que el motor no puede resolver. */
  unavailable?: boolean;
}

const key = (glyph: Glyph, insertLatex: string, ariaLabel: string, unavailable?: boolean): KeyDef => ({
  glyph,
  insertLatex,
  ariaLabel,
  unavailable,
});

// ---- Rejilla base (spec §3.1, reordenada tras el rediseño) ----
const BASE_GRID: KeyDef[][] = [
  [
    key("sin", "\\sin\\left(#0\\right)", "seno"),
    key("cos", "\\cos\\left(#0\\right)", "coseno"),
    key("tan", "\\tan\\left(#0\\right)", "tangente"),
    key("π", "\\pi", "pi"),
    key("θ", "\\theta", "theta"),
  ],
  [
    key("ln", "\\ln\\left(#0\\right)", "logaritmo natural"),
    key("log", "\\log\\left(#0\\right)", "logaritmo base 10"),
    key({ sub: BOX, base: "log" }, "\\log_{#0}\\left(#1\\right)", "logaritmo con base"),
    key("e", "e", "e"),
    key({ italic: "i" }, "i", "número imaginario"),
  ],
  [
    key({ sup: "2", base: BOX }, "#0^2", "al cuadrado"),
    key({ sup: "n", base: BOX }, "#0^{#1}", "potencia general"),
    key({ sqrt: BOX }, "\\sqrt{#0}", "raíz cuadrada"),
    key({ sqrt: BOX, index: "3" }, "\\sqrt[3]{#0}", "raíz cúbica"),
    key("∞", "\\infty", "infinito"),
  ],
  [
    key("|a|", "\\left|#0\\right|", "valor absoluto"),
    key("n!", "#0!", "factorial"),
    key({ italic: "x" }, "x", "variable x"),
    key({ italic: "y" }, "y", "variable y"),
    key("=", "=", "igual"),
  ],
];

const NUMPAD: KeyDef[][] = [
  [key("7", "7", "7"), key("8", "8", "8"), key("9", "9", "9"), key("÷", "\\frac{#0}{#1}", "dividir"), key("⌫", "", "borrar")],
  [key("4", "4", "4"), key("5", "5", "5"), key("6", "6", "6"), key("·", "\\cdot", "multiplicar"), key("(", "(", "paréntesis izquierdo")],
  [key("1", "1", "1"), key("2", "2", "2"), key("3", "3", "3"), key("−", "-", "restar"), key(")", ")", "paréntesis derecho")],
  [key("0", "0", "0"), key(".", ".", "punto"), key("%", "\\%", "porcentaje"), key("+", "+", "sumar"), key("⏎", "", "calcular")],
];

const RELATIONAL_ROW: KeyDef[] = [
  key("<", "<", "menor que"),
  key(">", ">", "mayor que"),
  key("≤", "\\le", "menor o igual que"),
  key("≥", "\\ge", "mayor o igual que"),
];

// ---- Tira de Cálculo (2 renglones, debajo de los íconos de resolución) ----
const CALCULUS_ROW_1: KeyDef[] = [
  key("∫", "\\int #0\\,dx", "integral indefinida"),
  key({ base: "∫", sub: BOX, sup: BOX }, "\\int_{#0}^{#1}#2\\,dx", "integral definida"),
  key("Σ", "\\sum_{#0}^{#1}#2", "sumatoria"),
];

const CALCULUS_ROW_2: KeyDef[] = [
  key({ frac: ["d", "dx"] }, "\\frac{d}{dx}\\left(#0\\right)", "derivada"),
  key({ frac: ["d²", "dx²"] }, "\\frac{d^2}{dx^2}\\left(#0\\right)", "derivada segunda"),
  // El glifo muestra "n" (como en la referencia), pero la plantilla
  // inserta un "3" literal editable — no "n" — para que si el usuario no
  // lo cambia, siga dando un resultado real (orden 3) en vez de caer en
  // silencio a orden 1 (mismo tipo de bug "respuesta plausible pero
  // incorrecta sin aviso" que se cazó varias veces esta sesión).
  key({ frac: ["dⁿ", "dxⁿ"] }, "\\frac{d^3}{dx^3}\\left(#0\\right)", "derivada de orden n (edita el 3 por el orden que quieras)"),
  key({ frac: ["∂", "∂x"] }, "", "derivada parcial", true),
  key({ base: "lim", sub: "x→0" }, "\\lim_{x\\to0}#0", "límite en 0"),
  key({ base: "lim", sub: "x→∞" }, "\\lim_{x\\to\\infty}#0", "límite al infinito"),
  key({ base: "lim", sub: "x→0+" }, "\\lim_{x\\to0^+}#0", "límite lateral derecho"),
  key({ base: "lim", sub: "x→0-" }, "\\lim_{x\\to0^-}#0", "límite lateral izquierdo"),
];

// ---- Menús flotantes por categoría (spec §3.5) — solo Trig/Stat tras el
// rediseño; mod/GCD/LCM se reubicaron aquí desde la extinta "Alg". ----
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
        key("sort", "\\mathrm{sort}\\left(#0\\right)", "ordenar"),
        key("mad", "\\mathrm{mad}\\left(#0\\right)", "desviación absoluta media"),
      ],
    },
    {
      // Reubicadas desde la extinta pestaña "Alg" (rediseño del teclado).
      section: "Número entero",
      keys: [
        key("mod", "\\mathrm{mod}\\left(#0,#1\\right)", "módulo"),
        key("GCD", "\\gcd\\left(#0,#1\\right)", "máximo común divisor"),
        key("LCM", "\\mathrm{lcm}\\left(#0,#1\\right)", "mínimo común múltiplo"),
      ],
    },
  ],
};

const CATEGORIES = ["Trig", "Stat"] as const;

interface MathKeyboardProps {
  field: MathField;
  onBackspace: () => void;
  onEnter: () => void;
  onClearField: () => void;
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
  onClearField,
  onSolveEquation,
  onSolveSystem,
  onSimplify,
}: MathKeyboardProps) {
  const [openCategory, setOpenCategory] = useState<(typeof CATEGORIES)[number] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function press(k: KeyDef) {
    if (k.unavailable) {
      setNotice(`${k.ariaLabel}: todavía no disponible.`);
      window.setTimeout(() => setNotice(null), 2500);
      return;
    }
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
      {notice && (
        <div className="absolute bottom-full left-3 right-3 mb-1.5 rounded-lg bg-chrome-soft px-3 py-2 text-center text-xs text-bone shadow-lg">
          {notice}
        </div>
      )}

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

      {/* Tira de Cálculo — pedido: justo debajo de los 3 íconos de arriba */}
      <div className="relative mb-1.5 rounded-lg bg-chrome-soft/60 p-1.5">
        <div className="mb-1 grid grid-cols-3 gap-1">
          {CALCULUS_ROW_1.map((k, i) => (
            <button
              key={i}
              onClick={() => press(k)}
              aria-label={k.ariaLabel}
              className={
                k.unavailable
                  ? "rounded-md bg-chrome-soft py-1.5 text-[11px] text-bone/40 hover:bg-chrome-soft/70"
                  : "rounded-md bg-chrome-soft py-1.5 text-[11px] text-bone hover:bg-chrome-soft/70"
              }
            >
              <KeyGlyph glyph={k.glyph} />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-1">
          {CALCULUS_ROW_2.map((k, i) => (
            <button
              key={i}
              onClick={() => press(k)}
              aria-label={k.ariaLabel}
              className={
                k.unavailable
                  ? "rounded-md bg-chrome-soft py-1.5 text-[10px] text-bone/40 hover:bg-chrome-soft/70"
                  : "rounded-md bg-chrome-soft py-1.5 text-[10px] text-bone hover:bg-chrome-soft/70"
              }
            >
              <KeyGlyph glyph={k.glyph} />
            </button>
          ))}
        </div>
        <button
          onClick={onClearField}
          aria-label="Borrar todo el campo"
          title="Borrar todo"
          className="absolute -right-1 -top-1 rounded-md bg-chrome p-1.5 text-bone/70 hover:text-bone"
        >
          🗑
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

      {/* Operadores relacionales (útiles para el router de ecuación/desigualdad) */}
      <div className="grid grid-cols-4 gap-1">
        {RELATIONAL_ROW.map((k, i) => (
          <button
            key={i}
            onClick={() => press(k)}
            aria-label={k.ariaLabel}
            className="rounded-md bg-paper-soft py-1.5 text-sm text-ink hover:bg-paper-line/60"
          >
            <KeyGlyph glyph={k.glyph} />
          </button>
        ))}
      </div>
    </div>
  );
}
