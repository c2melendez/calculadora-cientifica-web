// Evaluador numérico propio (spec v10 §10, enfoque híbrido) — usado como
// fallback cuando el cálculo simbólico con Algebrite falla o no es seguro
// de asumir, y como único método para integrales definidas por Simpson.
//
// Se implementa aparte, en vez de depender de la sustitución numérica de
// Algebrite (`float(subst(...))`), porque no se pudo verificar el formato
// exacto de esa API sin poder compilar contra la librería real (ver
// "Riesgos pendientes" en el README). Este evaluador es un parser
// recursivo-descendente propio sobre la MISMA sintaxis Algebrite que ya
// produce el parser del Módulo 2, así que no depende de Algebrite en
// absoluto — solo de las reglas de precedencia estándar.

import { ErrorCode, type AppError } from "../types";

type Fn = (x: number) => number;

const UNARY_FUNCTIONS: Record<string, Fn> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  arcsin: Math.asin,
  arccos: Math.acos,
  arctan: Math.atan,
  sec: (x) => 1 / Math.cos(x),
  csc: (x) => 1 / Math.sin(x),
  cot: (x) => 1 / Math.tan(x),
  // Fase 3: sinh/cosh/tanh SÍ los evalúa Algebrite con float(...), pero se
  // incluyen aquí también por si el fallback numérico los recibe desde
  // otra ruta (ej. una integral/límite con una hiperbólica adentro).
  // asinh/acosh/atanh/sign, en cambio, Algebrite NO los evalúa ni con
  // float() (confirmado probando contra el paquete real) — para estos,
  // este fallback es el ÚNICO camino a un valor numérico.
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  asinh: Math.asinh,
  acosh: Math.acosh,
  atanh: Math.atanh,
  exp: Math.exp,
  sign: Math.sign,
  factorial: (x) => {
    if (!Number.isInteger(x) || x < 0) return NaN;
    let result = 1;
    for (let k = 2; k <= x; k++) result *= k;
    return result;
  },
  ln: Math.log,
  log: Math.log10,
  sqrt: Math.sqrt,
  abs: Math.abs,
};

function parseError(message: string): AppError {
  return { code: ErrorCode.DOMAIN_ERROR, message };
}

/** Compila una expresión en sintaxis Algebrite a una función JS evaluable numéricamente. */
export function compileNumeric(expr: string, variable: string): Fn {
  let pos = 0;
  const s = expr;

  function peek(): string {
    return s[pos];
  }
  function eof(): boolean {
    return pos >= s.length;
  }

  function parseExpr(): (x: number) => number {
    let left = parseTerm();
    while (!eof() && (peek() === "+" || peek() === "-")) {
      const op = peek();
      pos++;
      const right = parseTerm();
      const prevLeft = left;
      left = op === "+" ? (x) => prevLeft(x) + right(x) : (x) => prevLeft(x) - right(x);
    }
    return left;
  }

  function parseTerm(): (x: number) => number {
    let left = parseUnary();
    while (!eof() && (peek() === "*" || peek() === "/")) {
      const op = peek();
      pos++;
      const right = parseUnary();
      const prevLeft = left;
      left = op === "*" ? (x) => prevLeft(x) * right(x) : (x) => prevLeft(x) / right(x);
    }
    return left;
  }

  function parseUnary(): (x: number) => number {
    if (peek() === "+") {
      pos++;
      return parseUnary(); // "+" unario es identidad — BUG detectado en revisión: faltaba, solo se manejaba "-"
    }
    if (peek() === "-") {
      pos++;
      const inner = parseUnary();
      return (x) => -inner(x);
    }
    return parsePower();
  }

  function parsePower(): (x: number) => number {
    const base = parseAtom();
    if (!eof() && peek() === "^") {
      pos++;
      const exponent = parseUnary(); // asociatividad simple, suficiente para esta calculadora
      return (x) => Math.pow(base(x), exponent(x));
    }
    return base;
  }

  function parseAtom(): (x: number) => number {
    if (eof()) throw parseError("Expresión numérica incompleta.");

    if (peek() === "(") {
      pos++;
      const inner = parseExpr();
      if (peek() !== ")") throw parseError('Se esperaba ")".');
      pos++;
      return inner;
    }

    if (/[0-9]/.test(peek())) {
      const match = s.slice(pos).match(/^[0-9]+(\.[0-9]+)?/)!;
      pos += match[0].length;
      const value = parseFloat(match[0]);
      return () => value;
    }

    if (/[a-zA-Z]/.test(peek())) {
      const match = s.slice(pos).match(/^[a-zA-Z]+/)!;
      const name = match[0];
      pos += name.length;

      if (name === "pi") return () => Math.PI;
      if (name === "e" && peek() !== "(") return () => Math.E;

      if (UNARY_FUNCTIONS[name]) {
        if (peek() !== "(") throw parseError(`Se esperaba "(" después de "${name}".`);
        pos++;
        const arg = parseExpr();
        if (peek() !== ")") throw parseError('Se esperaba ")".');
        pos++;
        const fn = UNARY_FUNCTIONS[name];
        return (x) => fn(arg(x));
      }

      if (name === variable) return (x) => x;

      throw parseError(`No se puede evaluar numéricamente la variable/función desconocida "${name}".`);
    }

    throw parseError(`Carácter numérico inesperado: "${peek()}".`);
  }

  const compiled = parseExpr();
  if (pos !== s.length) throw parseError("Expresión numérica con caracteres sobrantes al final.");
  return compiled;
}

/** Integración numérica por la regla de Simpson compuesta. */
export function simpsonIntegral(f: Fn, a: number, b: number, n = 1000): number {
  const evenN = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / evenN;
  let sum = f(a) + f(b);
  for (let i = 1; i < evenN; i++) {
    const x = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * f(x);
  }
  return (h / 3) * sum;
}

/** Estima un límite por acercamiento numérico desde ambos lados. */
export function numericLimit(
  f: Fn,
  point: number,
  direction: "both" | "left" | "right" = "both",
): { value: number; converged: boolean } {
  const epsilons = [1e-2, 1e-3, 1e-4, 1e-5, 1e-6];
  const evalSide = (sign: 1 | -1) =>
    epsilons.map((eps) => f(point + sign * eps)).filter((v) => Number.isFinite(v));

  const rightVals = direction !== "left" ? evalSide(1) : [];
  const leftVals = direction !== "right" ? evalSide(-1) : [];

  const last = (arr: number[]) => arr[arr.length - 1];
  const candidates = [...leftVals, ...rightVals];
  if (candidates.length === 0) return { value: NaN, converged: false };

  const rightEstimate = rightVals.length ? last(rightVals) : undefined;
  const leftEstimate = leftVals.length ? last(leftVals) : undefined;

  if (rightEstimate !== undefined && leftEstimate !== undefined) {
    const converged = Math.abs(rightEstimate - leftEstimate) < 1e-3;
    return { value: (rightEstimate + leftEstimate) / 2, converged };
  }
  return { value: (rightEstimate ?? leftEstimate)!, converged: true };
}
