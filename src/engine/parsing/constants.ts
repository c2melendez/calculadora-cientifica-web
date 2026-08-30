// Constantes del parser — Módulo 2, spec v10 (hereda las reglas de sintaxis
// de v9 §3, adaptadas a que la entrada llega como LaTeX de MathLive).

/**
 * Identificadores multi-letra válidos como variables libres (spec v9 §3).
 * Se extraen ANTES de aplicar multiplicación implícita, para que "theta" no
 * se parta en "t*h*e*t*a". Añade aquí cualquier variable multi-letra nueva
 * que el proyecto necesite soportar.
 */
export const RESERVED_MULTI_LETTER_IDENTIFIERS = [
  "theta",
  "alpha",
  "beta",
  "gamma",
  "delta",
  "lambda",
  "mu",
  "sigma",
  "omega",
  "rho",
];

/** Constantes reconocidas (no son variables libres). */
export const RESERVED_CONSTANTS = ["pi", "e", "i", "oo", "tau", "phi"];

/**
 * Sustituciones para constantes que Algebrite no conoce nativamente (a
 * diferencia de pi/e/i/oo, que sí entiende tal cual). Se aplican en
 * tokensToAlgebrite (Módulo 2) antes de enviar la expresión a Algebrite —
 * Fase 3 de la hoja de ruta ("constantes": τ, φ).
 */
export const CONSTANT_SUBSTITUTIONS: Record<string, string> = {
  tau: "(2*pi)",
  phi: "((1+sqrt(5))/2)",
};

/**
 * Funciones conocidas con su(s) aridad(es) válida(s). `log` acepta 1 o 2
 * argumentos (log(x) = ln, log(x,b) = base b); el resto exactamente 1,
 * según spec v9 §3. Hiperbólicas/exp/sign y factorial/nPr/nCr añadidas en
 * Fase 3 de la hoja de ruta ("motor científico completo").
 */
export const FUNCTION_ARITY: Record<string, number[]> = {
  sin: [1],
  cos: [1],
  tan: [1],
  arcsin: [1],
  arccos: [1],
  arctan: [1],
  sec: [1],
  csc: [1],
  cot: [1],
  sinh: [1],
  cosh: [1],
  tanh: [1],
  asinh: [1],
  acosh: [1],
  atanh: [1],
  ln: [1],
  log: [1, 2],
  sqrt: [1],
  abs: [1],
  exp: [1],
  sign: [1],
  factorial: [1],
  nPr: [2],
  nCr: [2],
  // Fase 10 / auditoría Fase 0 v2: registradas aquí para que el tokenizer
  // las reconozca como "function" (ver tokenize.ts) en vez de tratarlas
  // como identificador + multiplicación implícita (ej. "mean(1,2,3)" se
  // convertía en "mean*(1,2,3)"). mod/gcd/lcm SÍ son nativas de Algebrite
  // (confirmado probando el paquete real) — arity fija 2, sin fallback
  // propio. mean/median/mode/min/max/range/stdev/variance/sort/mad NO son
  // nativas (confirmado igual) y se resuelven en engine/statFunctions.ts;
  // aceptan de 1 a 20 argumentos (límite razonable, no especificado antes).
  mod: [2],
  gcd: [2],
  lcm: [2],
  ...Object.fromEntries(
    ["mean", "median", "mode", "min", "max", "range", "sort", "mad"].map((name) => [
      name,
      Array.from({ length: 20 }, (_, i) => i + 1),
    ]),
  ),
  // stdev/variance necesitan al menos 2 valores (no tiene sentido una
  // desviación estándar de un solo dato) — ver engine/statFunctions.ts.
  // NOTA: la tecla del teclado etiquetada "variance" en realidad inserta
  // el macro \mathrm{var} (MathKeyboard.tsx), no \mathrm{variance} — el
  // identificador real que llega aquí es "var". Se registran ambos
  // nombres por si se escribe "variance" a mano.
  stdev: Array.from({ length: 19 }, (_, i) => i + 2),
  var: Array.from({ length: 19 }, (_, i) => i + 2),
  variance: Array.from({ length: 19 }, (_, i) => i + 2),
};

export const KNOWN_FUNCTION_NAMES = Object.keys(FUNCTION_ARITY);

/** Todo identificador reconocido (variables multi-letra + constantes + funciones). */
export const ALL_KNOWN_IDENTIFIERS = [
  ...RESERVED_MULTI_LETTER_IDENTIFIERS,
  ...RESERVED_CONSTANTS,
  ...KNOWN_FUNCTION_NAMES,
].sort((a, b) => b.length - a.length); // más largos primero, para greedy match
