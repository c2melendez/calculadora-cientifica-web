// Etapa 1 (spec v9 §3, adaptada a entrada LaTeX de MathLive): convierte los
// macros de LaTeX que produce MathLive a una notación lineal, y normaliza
// los caracteres Unicode que el usuario pudiera pegar directamente.

import { ErrorCode, type AppError } from "../../types";

function parseError(message: string): AppError {
  return { code: ErrorCode.PARSE_ERROR, message };
}

/**
 * Reemplaza \sqrt{...} y \sqrt[n]{...} de forma balanceada (no con regex
 * ingenuo, que rompe con anidamiento — ej. \sqrt{\sqrt{x}}).
 */
function replaceBalanced(
  input: string,
  openToken: string,
  transform: (inner: string, index: number) => string,
): string {
  let result = "";
  let i = 0;
  while (i < input.length) {
    if (input.startsWith(openToken, i)) {
      const braceStart = input.indexOf("{", i);
      if (braceStart === -1) throw parseError(`Llave de apertura faltante tras "${openToken}".`);
      let depth = 1;
      let j = braceStart + 1;
      while (j < input.length && depth > 0) {
        if (input[j] === "{") depth++;
        else if (input[j] === "}") depth--;
        j++;
      }
      if (depth !== 0) throw parseError(`Llaves sin balancear tras "${openToken}".`);
      const inner = input.slice(braceStart + 1, j - 1);
      result += transform(inner, i);
      i = j;
    } else {
      result += input[i];
      i++;
    }
  }
  return result;
}

/** Etapa 1: macros LaTeX -> notación lineal compatible con Algebrite. */
export function preprocessLatex(latex: string): string {
  let expr = latex;

  // \frac{a}{b} -> ((a)/(b)) — debe ir antes que otros reemplazos porque
  // "a" y "b" pueden contener a su vez otros macros ya procesados de forma
  // recursiva al reprocesar el string completo tras cada pasada balanceada.
  let prevLength = -1;
  while (expr.includes("\\frac") && expr.length !== prevLength) {
    prevLength = expr.length;
    expr = replaceFracOnce(expr);
  }

  // \sqrt[n]{x} (raíz enésima, botón ⁿ√) debe procesarse ANTES que el
  // \sqrt{x} genérico de abajo. BUG detectado en revisión: si el orden es
  // al revés, `replaceBalanced` para "\sqrt" encuentra la primera "{" de
  // \sqrt[3]{x} — que es la del radicando, no hay ninguna antes del "[3]" —
  // y consume solo esa parte, descartando el índice "[3]" en silencio y
  // convirtiendo la raíz cúbica en una raíz cuadrada sin ningún error.
  expr = expr.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, "($2)^(1/($1))");
  expr = replaceBalanced(expr, "\\sqrt", (inner) => `sqrt(${inner})`);

  expr = expr
    .replace(/\\left\|/g, "abs(")
    .replace(/\\right\|/g, ")")
    .replace(/\\cdot/g, "*")
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi/g, "pi")
    .replace(/\\sin\^\{-1\}/g, "arcsin")
    .replace(/\\cos\^\{-1\}/g, "arccos")
    .replace(/\\tan\^\{-1\}/g, "arctan")
    .replace(/\\sin/g, "sin")
    .replace(/\\cos/g, "cos")
    .replace(/\\tan/g, "tan")
    .replace(/\\ln/g, "ln")
    .replace(/\\log/g, "log")
    .replace(/\^\{([^{}]*)\}/g, "^($1)")
    .replace(/\\left\(/g, "(")
    .replace(/\\right\)/g, ")")
    .replace(/\\,/g, "")
    .replace(/\\ /g, "")
    .replace(/\s+/g, "");

  return expr;
}

function replaceFracOnce(expr: string): string {
  const start = expr.indexOf("\\frac");
  if (start === -1) return expr;
  let i = start + "\\frac".length;

  function readGroup(pos: number): [string, number] {
    if (expr[pos] !== "{") throw parseError("Se esperaba \"{\" tras \\frac.");
    let depth = 1;
    let j = pos + 1;
    while (j < expr.length && depth > 0) {
      if (expr[j] === "{") depth++;
      else if (expr[j] === "}") depth--;
      j++;
    }
    if (depth !== 0) throw parseError("Llaves sin balancear en \\frac.");
    return [expr.slice(pos + 1, j - 1), j];
  }

  const [numerator, afterNum] = readGroup(i);
  const [denominator, afterDen] = readGroup(afterNum);
  return expr.slice(0, start) + `((${numerator})/(${denominator}))` + expr.slice(afterDen);
}

/**
 * Etapa 2: normalización de caracteres Unicode que el usuario podría pegar
 * directamente (spec v9 §3). `√` envuelve únicamente el siguiente token
 * atómico: número, identificador simple, o paréntesis balanceado.
 */
export function normalizeUnicode(expr: string): string {
  let out = expr.replace(/π/g, "pi").replace(/∞/g, "oo");

  out = out.replace(/√/g, "\u0000SQRT\u0000");
  let result = "";
  let i = 0;
  while (i < out.length) {
    if (out.startsWith("\u0000SQRT\u0000", i)) {
      i += "\u0000SQRT\u0000".length;
      if (out[i] === "(") {
        let depth = 1;
        let j = i + 1;
        while (j < out.length && depth > 0) {
          if (out[j] === "(") depth++;
          else if (out[j] === ")") depth--;
          j++;
        }
        if (depth !== 0) throw parseError("Paréntesis sin balancear tras √.");
        result += `sqrt(${out.slice(i + 1, j - 1)})`;
        i = j;
      } else {
        const match = out.slice(i).match(/^[0-9]+(\.[0-9]+)?|^[a-zA-Z]/);
        if (!match) throw parseError("√ debe preceder a un número, variable o paréntesis.");
        result += `sqrt(${match[0]})`;
        i += match[0].length;
      }
    } else {
      result += out[i];
      i++;
    }
  }
  return result;
}

/**
 * Etapa 3: validación estricta de punto decimal (spec v9 §3). Solo se
 * acepta "dígito.dígito"; se rechazan ".5", "5.", notación científica.
 */
export function validateDecimalPoints(expr: string): void {
  const badLeading = /(?<![0-9])\.[0-9]/;
  const badTrailing = /[0-9]\.(?![0-9])/;
  const scientific = /[0-9]e[+-]?[0-9]/i;
  if (badLeading.test(expr) || badTrailing.test(expr)) {
    throw parseError('Formato decimal inválido: usa "dígito.dígito" (ej. 3.14), no ".5" ni "5.".');
  }
  if (scientific.test(expr)) {
    throw parseError("Notación científica no soportada (ej. 1e5).");
  }
}
