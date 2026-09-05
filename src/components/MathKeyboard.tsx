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
//
// P3 (spec v2 §4, teclado redistribuido, migración completa al layout
// pedido) — reemplaza BASE_GRID+NUMPAD (2 bloques de 5 columnas) por:
// - CORE_GRID: núcleo fijo 7×4, siempre visible (§4.5).
// - SYMBOLS_ROW_1/2: 2 filas de 9, dentro de la pestaña nueva "Símbolos"
//   (§4.4) — antes vivían siempre visibles en BASE_GRID.
// - CATEGORY_MENUS gana "Logarítmicas"/"Constantes" (contenido AMBIGUO,
//   ver comentario junto a CATEGORY_MENUS) y "Trig" se renombra a
//   "Trigonométricas". "Stat" se conserva temporalmente (ver mismo
//   comentario) aunque no esté en la lista literal de 4 pestañas de §4.4.
// - CALCULUS_ROW_1 gana Π (unavailable)/LCM/GCD (§4.2).
// - CALCULUS_ROW_2 gana lim_{x→a±} (tecla nueva, §4.3) y pierde el
//   backspace (se mudó a SYMBOLS_ROW_2). lim_{x→∞} se conserva pese a no
//   estar en la lista literal de 6 teclas de §4.3 — tiene cómputo real,
//   quitarla violaría la regla de no-regresión (§10).
// - `=`/`⏎` quedan en CORE_GRID (col5/col6, fila4) con handlers
//   explícitamente distintos — ver pressBase (§4.6).
// - normalize.ts recibe un ajuste mínimo (regex de signo de límite
//   lateral, acepta con/sin llaves) — requerido por la tecla nueva de
//   límites laterales, permitido explícitamente por §10.

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

// ---- P3 (spec v2 §4.5): núcleo fijo, siempre visible, 7 columnas × 4
// filas. Reemplaza a BASE_GRID+NUMPAD (rejilla informal de 2 bloques de
// 5 columnas). Insertan exactamente lo mismo que insertaban antes — solo
// cambió su posición y agrupación (regla de no-regresión §10: nada de
// lógica de inserción nueva aquí, salvo lo explícitamente permitido).
const CORE_GRID: KeyDef[][] = [
  [
    key("7", "7", "7"),
    key("8", "8", "8"),
    key("9", "9", "9"),
    key("sin", "\\sin\\left(#0\\right)", "seno"),
    key("log", "\\log\\left(#0\\right)", "logaritmo base 10"),
    key("(", "(", "paréntesis izquierdo"),
    key("×", "\\cdot", "multiplicar"),
  ],
  [
    key("4", "4", "4"),
    key("5", "5", "5"),
    key("6", "6", "6"),
    key("cos", "\\cos\\left(#0\\right)", "coseno"),
    key("ln", "\\ln\\left(#0\\right)", "logaritmo natural"),
    key(")", ")", "paréntesis derecho"),
    key("−", "-", "restar"),
  ],
  [
    key("1", "1", "1"),
    key("2", "2", "2"),
    key("3", "3", "3"),
    key("tan", "\\tan\\left(#0\\right)", "tangente"),
    key({ sub: BOX, base: "log" }, "\\log_{#0}\\left(#1\\right)", "logaritmo con base"),
    // Sin precedente en el motor (ni Algebrite ni SymPy vía este código
    // lo usaban antes) — plantilla simple, mismo patrón que cualquier
    // símbolo existente. Riesgo menor documentado en el cierre del P3.
    key("±()", "\\pm\\left(#0\\right)", "más/menos"),
    key("+", "+", "sumar"),
  ],
  [
    key("0", "0", "0"),
    key(".", ".", "punto"),
    key("%", "\\%", "porcentaje"),
    key({ sup: "x", base: "e" }, "e^{#0}", "e a la x"),
    key("=", "=", "igual"),
    key("⏎", "", "calcular"),
    key("÷", "\\frac{#0}{#1}", "dividir"),
  ],
];

// ---- P3 (spec v2 §4.4): grid contextual bajo pestañas, fila 1 (9
// columnas, sin cambios de contenido respecto a lo que ya insertaban
// x²/xʸ/√x/∛x/n!/|x| en la vieja BASE_GRID) + fila 2 (9 columnas, CAMBIA:
// agrega "z" —variable nueva, inserción trivial igual que x/y— y ⌫
// reemplaza a ÷, que se mudó al núcleo). Vive dentro de la pestaña
// "Símbolos".
const SYMBOLS_ROW_1: KeyDef[] = [
  key({ sup: "2", base: BOX }, "#0^2", "al cuadrado"),
  key({ sup: "y", base: BOX }, "#0^{#1}", "potencia general"),
  key({ sqrt: BOX }, "\\sqrt{#0}", "raíz cuadrada"),
  key({ sqrt: BOX, index: "3" }, "\\sqrt[3]{#0}", "raíz cúbica"),
  key({ sup: "x", base: "10" }, "10^{#0}", "10 a la x"),
  key("exp", "\\exp\\left(#0\\right)", "exponencial"),
  key("|x|", "\\left|#0\\right|", "valor absoluto"),
  key("n!", "#0!", "factorial"),
  key("DEL", "", "borrar todo el campo"),
];

const SYMBOLS_ROW_2: KeyDef[] = [
  key({ italic: "i" }, "i", "número imaginario"),
  key("π", "\\pi", "pi"),
  key("e", "e", "e"),
  key("∞", "\\infty", "infinito"),
  key({ italic: "x" }, "x", "variable x"),
  key({ italic: "y" }, "y", "variable y"),
  key({ italic: "z" }, "z", "variable z"),
  key("θ", "\\theta", "theta"),
  key("⌫", "", "borrar"),
];

const RELATIONAL_ROW: KeyDef[] = [
  key("<", "<", "menor que"),
  key(">", ">", "mayor que"),
  key("≤", "\\le", "menor o igual que"),
  key("≥", "\\ge", "mayor o igual que"),
];

// ---- Tira de Cálculo (2 renglones, debajo de los íconos de resolución) ----
// P3 §4.2 (fila de cálculo, 6 teclas): se agregan Π (sin cómputo real en
// ningún motor — unavailable, mismo patrón que ∂/∂x) y LCM/GCD, que se
// mudan aquí desde el menú flotante "Stat" (sin cambiar su plantilla de
// inserción).
const CALCULUS_ROW_1: KeyDef[] = [
  key("∫", "\\int #0\\,dx", "integral indefinida"),
  key({ base: "∫", sub: BOX, sup: BOX }, "\\int_{#0}^{#1}#2\\,dx", "integral definida"),
  key("Σ", "\\sum_{#0}^{#1}#2", "sumatoria"),
  key("Π", "", "productoria", true),
  key("LCM", "\\mathrm{lcm}\\left(#0,#1\\right)", "mínimo común múltiplo"),
  key("GCD", "\\gcd\\left(#0,#1\\right)", "máximo común divisor"),
];

// P3 §4.3 (fila de derivadas/límites, CAMBIA): se agrega lim_{x→a±}
// (límites laterales, tecla nueva — explícitamente permitida por la
// sección 10) y se retira el backspace de esta fila (se traslada a
// SYMBOLS_ROW_2). lim_{x→∞} NO está en la lista literal de la spec, pero
// tiene cómputo real ya implementado — se conserva para no violar la
// regla de no quitar funciones matemáticas (documentado en el cierre).
const CALCULUS_ROW_2: KeyDef[] = [
  key({ frac: ["d", "dx"] }, "\\frac{d}{dx}\\left(#0\\right)", "derivada"),
  key({ frac: ["d²", "dx²"] }, "\\frac{d^2}{dx^2}\\left(#0\\right)", "derivada segunda"),
  key({ frac: ["dⁿ", "dxⁿ"] }, "\\frac{d^3}{dx^3}\\left(#0\\right)", "derivada de orden n (edita el 3 por el orden que quieras)"),
  key({ frac: ["∂", "∂x"] }, "", "derivada parcial", true),
  key({ base: "lim", sub: "x→a" }, "\\lim_{#0\\to#1}#2", "límite"),
  key({ base: "lim", sub: "x→∞" }, "\\lim_{#0\\to\\infty}#1", "límite al infinito"),
  key({ base: "lim", sub: "x→a±" }, "\\lim_{#0\\to#1^{#2}}#3", "límite lateral (edita + o - en el exponente)"),
];

// ---- Menús flotantes por categoría. P3 (spec v2 §4.4) pide 4 pestañas:
// Trigonométricas / Logarítmicas / Constantes / Símbolos.
//
// Decisión final de Carlos (post-P6/P7): "Logarítmicas" y "Constantes" se
// eliminan — su contenido eran accesos duplicados a botones que ya
// existen (ln/log/logₓ en el núcleo fijo, π/e/i/∞ en Símbolos), así que
// no aportaban nada nuevo. "Stat" también se elimina del teclado: ahora
// que existe el modo Estadística completo (P6), sus teclas (mean/median/
// stdev/nCr/nPr/mod/...) son redundantes.
const CATEGORY_MENUS: Record<string, { section: string; keys: KeyDef[] }[]> = {
  Trigonométricas: [
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
};

// "Símbolos" no usa el formato de secciones agrupadas (arriba) — spec
// §4.4 la define como 2 filas planas de 9 columnas (SYMBOLS_ROW_1/2),
// con su propio render especial (ver JSX más abajo).
//
// P4 (spec v2 §5, Complejos): pestaña nueva. |z| reutiliza LITERALMENTE
// la misma plantilla de inserción que |x| (SYMBOLS_ROW_1) — no se
// duplica la tecla, como pide la spec explícitamente. "⇄ Polar" inserta
// topolar(#0), resuelto en engine/complexFunctions.ts.
CATEGORY_MENUS.Complejos = [
  {
    section: "Funciones",
    keys: [
      key("Re()", "\\mathrm{re}\\left(#0\\right)", "parte real"),
      key("Im()", "\\mathrm{im}\\left(#0\\right)", "parte imaginaria"),
      key("arg()", "\\mathrm{arg}\\left(#0\\right)", "argumento"),
      key("conj()", "\\mathrm{conj}\\left(#0\\right)", "conjugado"),
      key("|z|", "\\left|#0\\right|", "módulo"),
      key("⇄ Polar", "\\mathrm{topolar}\\left(#0\\right)", "convertir a forma polar"),
    ],
  },
];

const CATEGORIES = ["Trigonométricas", "Símbolos", "Complejos"] as const;

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
    if (k.glyph === "f(x)=0") return onSolveEquation ? onSolveEquation() : press(k);
    press(k);
  }

  // P3 §4.4: DEL/⌫ viven ahora dentro del flyout "Símbolos" (SYMBOLS_ROW_1
  // fila 1 col 9 / SYMBOLS_ROW_2 fila 2 col 9), no en la rejilla siempre
  // visible — necesitan su propio dispatcher, análogo a pressBase.
  function pressSymbol(k: KeyDef) {
    if (k.glyph === "DEL") return onClearField();
    if (k.glyph === "⌫") return onBackspace();
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
          {openCategory === "Símbolos" ? (
            // P3 §4.4: layout especial de 2 filas × 9 columnas, distinto
            // del formato de secciones agrupadas que usan las demás
            // pestañas (Trigonométricas/Logarítmicas/Constantes/Stat).
            <div className="flex flex-col gap-1">
              <div className="grid grid-cols-9 gap-1">
                {SYMBOLS_ROW_1.map((k, i) => (
                  <button
                    key={`sym1-${i}`}
                    onClick={() => pressSymbol(k)}
                    aria-label={k.ariaLabel}
                    className="rounded-md bg-chrome py-2 text-[11px] text-bone hover:bg-chrome/70"
                  >
                    <KeyGlyph glyph={k.glyph} />
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-9 gap-1">
                {SYMBOLS_ROW_2.map((k, i) => (
                  <button
                    key={`sym2-${i}`}
                    onClick={() => pressSymbol(k)}
                    aria-label={k.ariaLabel}
                    className="rounded-md bg-chrome py-2 text-[11px] text-bone hover:bg-chrome/70"
                  >
                    <KeyGlyph glyph={k.glyph} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            CATEGORY_MENUS[openCategory].map((group) => (
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
            ))
          )}
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
        <div className="mb-1 grid grid-cols-6 gap-1">
          {CALCULUS_ROW_1.map((k, i) => (
            <button
              key={i}
              onClick={() => press(k)}
              aria-label={k.ariaLabel}
              className={
                k.unavailable
                  ? "rounded-md bg-chrome-soft py-1.5 text-[11px] text-bone/40 hover:bg-chrome-soft/70"
                  : ["LCM", "GCD"].includes(String(k.glyph))
                    ? "rounded-md border border-marker bg-chrome-soft py-1.5 text-[11px] font-medium text-marker hover:bg-chrome-soft/70"
                    : "rounded-md bg-chrome-soft py-1.5 text-[11px] text-bone hover:bg-chrome-soft/70"
              }
            >
              <KeyGlyph glyph={k.glyph} />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
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
      <div className="mb-1.5 flex flex-wrap gap-x-3 gap-y-1 px-1">
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

      {/* Núcleo fijo (P3 §4.5): 7 columnas × 4 filas, siempre visible.
          Estilo §4.7: números (fondo neutro oscuro), funciones (mismo
          fondo, texto ámbar), operadores ×/−/+/÷ (fondo ámbar sólido),
          = (contorno ámbar), ↵ (fondo azul sólido). */}
      {CORE_GRID.map((row, i) => (
        <div key={i} className="mb-1.5 grid grid-cols-7 gap-1">
          {row.map((k, j) => {
            const glyphStr = String(k.glyph);
            const isDigit = /^[0-9.%]$/.test(glyphStr);
            const isOperator = ["×", "−", "+", "÷"].includes(glyphStr);
            const isEquals = glyphStr === "=";
            const isEnter = glyphStr === "⏎";
            const className = isEnter
              ? "rounded-md bg-graph py-2.5 text-sm font-semibold text-paper hover:bg-graph/90"
              : isEquals
                ? "rounded-md border border-marker py-2.5 text-sm font-medium text-marker hover:bg-marker-soft/10"
                : isOperator
                  ? "rounded-md bg-marker py-2.5 text-base font-semibold text-chrome hover:bg-marker/90"
                  : isDigit
                    ? "rounded-md bg-chrome-soft/80 py-2.5 text-sm font-medium text-bone hover:bg-chrome-soft/60"
                    : "rounded-md bg-chrome-soft py-2.5 text-[11px] text-marker hover:bg-chrome-soft/70";
            return (
              <button key={j} onClick={() => pressBase(k)} aria-label={k.ariaLabel} className={className}>
                <KeyGlyph glyph={k.glyph} />
              </button>
            );
          })}
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
