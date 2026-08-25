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
};

export const KNOWN_FUNCTION_NAMES = Object.keys(FUNCTION_ARITY);

/** Todo identificador reconocido (variables multi-letra + constantes + funciones). */
export const ALL_KNOWN_IDENTIFIERS = [
  ...RESERVED_MULTI_LETTER_IDENTIFIERS,
  ...RESERVED_CONSTANTS,
  ...KNOWN_FUNCTION_NAMES,
].sort((a, b) => b.length - a.length); // más largos primero, para greedy match
