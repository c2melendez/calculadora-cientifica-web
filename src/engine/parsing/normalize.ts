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

  // d/dx: plantilla "\frac{d}{dx}\left(#0\right)" -> d((cuerpo),x), nativo
  // en Algebrite. Debe ir ANTES que el bucle \frac de abajo — si no, ese
  // bucle ya convirtió "\frac{d}{dx}" a "(d)/(dx)" antes de llegar aquí,
  // y el patrón deja de ser reconocible. A diferencia de ∫/Σ/Lim, esta
  // SÍ puede aparecer en medio de una expresión más grande (ej.
  // "\frac{d}{dx}\left(x^2\right)+1"), así que no se ancla al final del
  // string — se busca el paréntesis \left(...\right) que le corresponde
  // contando anidamiento, igual que replaceBalanced pero para \left(/
  // \right) en vez de llaves.
  //
  // Hallazgo (auditoría Fase 0 v2, decisión de Carlos: resolver inline):
  // antes de este fix, esta tecla no truena como ∫/Σ/Lim — es peor: dado
  // que "d" y "dx" quedaban como símbolos sueltos, el motor SÍ devolvía
  // un resultado, pero matemáticamente incorrecto y sin ningún error que
  // lo señalara (ej. d/dx(x^2) daba "d*x^2/dx" en vez de "2x").
  {
    const marker = "\\frac{d}{dx}\\left(";
    const idx = expr.indexOf(marker);
    if (idx !== -1) {
      let depth = 1;
      let j = idx + marker.length;
      while (j < expr.length && depth > 0) {
        if (expr.startsWith("\\left(", j)) {
          depth++;
          j += 6;
        } else if (expr.startsWith("\\right)", j)) {
          depth--;
          j += 7;
        } else {
          j++;
        }
      }
      if (depth !== 0) {
        throw parseError('Paréntesis sin balancear tras "d/dx".');
      }
      const body = expr.slice(idx + marker.length, j - 7);
      expr = `${expr.slice(0, idx)}d((${body}),x)${expr.slice(j)}`;
    }
  }

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

  // FIX (auditoría Fase 0 v2, Fase 10): \mathrm{nombre} es el macro que
  // MathLive usa para "texto no cursivo" — el teclado Fase A lo usa para
  // TODOS los nombres de función multi-letra del menú Alg/Stat (mod, GCD,
  // LCM, nCr, nPr, mean, median, mode, min, max, range, stdev, var, sort,
  // mad). Nunca se manejó aquí: antes de este fix, cualquiera de esas
  // teclas producía "Carácter no reconocido" en cuanto el usuario
  // presionaba "=" — un error de PARSEO, no solo "sin evaluar" (Algebrite
  // nunca llegaba a verlas). Se desenvuelve de forma balanceada, igual que
  // \sqrt, porque el nombre podría en teoría contener otros macros.
  expr = replaceBalanced(expr, "\\mathrm", (inner) => inner);

  // FIX (auditoría Fase 0 v2 → decisión de Carlos: resolver ∫/Lim/Σ
  // inline en vez de navegar a Cálculo): \int/\lim/\sum tampoco los
  // manejaba preprocessLatex — mismo efecto que \mathrm arriba, error de
  // parseo apenas se presiona "=". Estas 3 teclas están pensadas para ser
  // la expresión COMPLETA (mismo alcance que las funciones de
  // estadística), así que el cuerpo se toma como "el resto del string" —
  // no se soporta anidarlas dentro de algo más grande.
  //
  // ∫: plantilla fija "\int #0\,dx" (siempre respecto a x, sin variable
  // configurable) -> integral((cuerpo),x), nativo en Algebrite.
  //
  // Fase 2 externa: también se soporta la forma con límites,
  // \int_{a}^{b}...\,dx (no viene de una tecla del teclado — el teclado
  // solo tiene la indefinida — pero MathLive la acepta si se escribe a
  // mano con _/^). Se reescribe a un marcador "defintegral(cuerpo,a,b)"
  // que compute.worker.ts resuelve en DOS llamadas separadas a Algebrite
  // (antiderivada primero, después sustituir en el resultado ya
  // evaluado) — hallazgo real: Algebrite sustituye ANTES de resolver la
  // integral si subst() envuelve integral() sin evaluar todavía en la
  // misma llamada ("Stop: integral: sorry, could not find a solution"
  // con límites simbólicos como pi), el mismo motivo por el que
  // calcDefiniteIntegral (stepEngine/calculus.ts) siempre lo hizo en dos
  // pasos — no es solo estilo, es necesario.
  {
    const definiteMatch = expr.match(/\\int_\{([^{}]*)\}\^\{([^{}]*)\}(.*)\\,dx$/s);
    if (definiteMatch) {
      const [, lower, upper, body] = definiteMatch;
      expr = `defintegral((${body}),${lower},${upper})`;
    } else {
      const intMatch = expr.match(/\\int(.*)\\,dx$/s);
      if (intMatch) {
        expr = `integral((${intMatch[1]}),x)`;
      }
    }
  }

  // Σ: plantilla "\sum_{#0}^{#1}#2", #0 tipo "i=1" -> sum((cuerpo),i,1,#1),
  // nativo en Algebrite.
  {
    const sumMatch = expr.match(/\\sum_\{([^{}]*)\}\^\{([^{}]*)\}(.*)$/s);
    if (sumMatch) {
      const [, varStart, end, body] = sumMatch;
      const eqIndex = varStart.indexOf("=");
      if (eqIndex === -1) {
        throw parseError('Σ espera la forma "variable=inicio" (ej. i=1) en el límite inferior.');
      }
      const sumVar = varStart.slice(0, eqIndex);
      const start = varStart.slice(eqIndex + 1);
      expr = `sum((${body}),${sumVar},${start},${end})`;
    }
  }

  // Lim: plantilla "\lim_{#0}#1", #0 tipo "x\to0" -> limit((cuerpo),x,0).
  // A diferencia de integral/sum, limit() de Algebrite frecuentemente NO
  // evalúa (confirmado probando el paquete real) — el fallback numérico
  // para ese caso vive en compute.worker.ts (tryLimitFallback), reusando
  // el mismo evaluador numérico propio de Fase 3/Módulo de límites.
  {
    const limMatch = expr.match(/\\lim_\{([^{}]*)\}(.*)$/s);
    if (limMatch) {
      const [, varTo, body] = limMatch;
      const toIndex = varTo.indexOf("\\to");
      if (toIndex === -1) {
        throw parseError('Lim espera la forma "variable\\to punto" (ej. x\\to0) en el subíndice.');
      }
      const limVar = varTo.slice(0, toIndex);
      const point = varTo.slice(toIndex + "\\to".length);
      expr = `limit((${body}),${limVar},${point})`;
    }
  }

  expr = expr
    .replace(/\\left\|/g, "abs(")
    .replace(/\\right\|/g, ")")
    .replace(/\\cdot/g, "*")
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\pi/g, "pi")
    .replace(/\\infty/g, "oo")
    // FIX (auditoría Fase 0 v2, Fase 10): mismo bug que \mathrm arriba —
    // \gcd/\min/\max son macros LaTeX nativos (no \mathrm{...}) que
    // tampoco se manejaban, con el mismo efecto (error de parseo).
    .replace(/\\gcd/g, "gcd")
    .replace(/\\min/g, "min")
    .replace(/\\max/g, "max")
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
