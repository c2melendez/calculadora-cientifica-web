// Etapa 9 + orquestador (spec v9 §3, spec v10 Módulo 2). Único punto de
// entrada del parser completo — reemplaza al placeholder
// `modes/BasicScientific/latexToAlgebrite.ts` del Módulo 1.
//
// Pipeline: preprocesar LaTeX -> normalizar Unicode -> validar decimales ->
// tokenizar -> multiplicación implícita -> validar aridad de funciones ->
// ensamblar string Algebrite -> (si es ecuación) aplicar igualdad -> aplicar
// conversión de ángulo RAD/GRAD.

import { preprocessLatex, normalizeUnicode, validateDecimalPoints } from "./normalize";
import { tokenize, type Token } from "./tokenize";
import { insertImplicitMultiplication } from "./implicitMultiplication";
import { validateFunctionArity } from "./functionArity";
import { splitEquation } from "./equationSplit";
import { expandPostfixOperators } from "./postfixOperators";
import { KNOWN_FUNCTION_NAMES, CONSTANT_SUBSTITUTIONS } from "./constants";

export interface ParsedExpression {
  /** Cadena lista para pasar a Algebrite. Para ecuaciones, es "(left)-(right)". */
  algebrite: string;
  /** true si la expresión original contenía "=" (es una ecuación). */
  isEquation: boolean;
  /** Variables libres detectadas (para modos que necesitan saber cuál despejar). */
  freeVariables: string[];
  /** Lado izquierdo en sintaxis Algebrite (solo con sentido si isEquation). */
  leftAlgebrite: string;
  /** Lado derecho en sintaxis Algebrite ("0" si no es ecuación). */
  rightAlgebrite: string;
}

function tokensToAlgebrite(tokens: Token[]): string {
  return tokens
    .map((t) => {
      if (t.type === "function") return t.value; // el "(" siguiente ya viene en el token de lparen
      // Fase 3: τ/φ no son nativas de Algebrite — se sustituyen por su
      // valor exacto (2π / razón áurea) antes de ensamblar el string.
      if (t.type === "identifier" && t.value in CONSTANT_SUBSTITUTIONS) {
        return CONSTANT_SUBSTITUTIONS[t.value];
      }
      return t.value;
    })
    .join("");
}

/**
 * nPr/nCr no son funciones nativas de Algebrite (confirmado probando
 * contra el paquete real) — se reescriben en términos de factorial, que
 * sí es nativo, antes de enviar la expresión. Mismo patrón de escaneo
 * balanceado que wrapFunctionArgsWithDegToRad, para dos argumentos.
 */
function rewriteBinaryFunction(expr: string, fnName: string, build: (a: string, b: string) => string): string {
  let result = "";
  let i = 0;
  while (i < expr.length) {
    if (expr.startsWith(`${fnName}(`, i)) {
      const start = i + fnName.length;
      let depth = 1;
      let j = start + 1;
      let commaIndex = -1;
      while (j < expr.length && depth > 0) {
        if (expr[j] === "(") depth++;
        else if (expr[j] === ")") depth--;
        else if (expr[j] === "," && depth === 1 && commaIndex === -1) commaIndex = j;
        j++;
      }
      if (commaIndex === -1) {
        // Forma malformada (sin coma en el nivel esperado) — se deja tal
        // cual para que Algebrite reporte el error, en vez de asumir algo.
        result += expr.slice(i, j);
        i = j;
        continue;
      }
      const a = expr.slice(start + 1, commaIndex);
      const b = expr.slice(commaIndex + 1, j - 1);
      result += build(a, b);
      i = j;
    } else {
      result += expr[i];
      i++;
    }
  }
  return result;
}

function rewriteCombinatorics(algebrite: string): string {
  let result = algebrite;
  result = rewriteBinaryFunction(result, "nPr", (n, r) => `(factorial(${n})/factorial((${n})-(${r})))`);
  result = rewriteBinaryFunction(result, "nCr", (n, r) => `(factorial(${n})/(factorial(${r})*factorial((${n})-(${r}))))`);
  return result;
}

function extractFreeVariables(tokens: Token[]): string[] {
  const vars = new Set<string>();
  for (const t of tokens) {
    if (t.type === "identifier") vars.add(t.value);
  }
  return [...vars];
}

/** Convierte los argumentos de trig DIRECTAS (sin/cos/tan) de grados a radianes cuando angleMode === "GRAD" (spec v10 §5: alcance exacto de angle_unit). "GRAD" es una decisión deliberada del proyecto para significar grados sexagesimales, no gradianes — ver spec_calculadora_v10_sin_backend.md. */
function applyAngleMode(algebrite: string, angleMode: "RAD" | "GRAD"): string {
  if (angleMode === "RAD") return algebrite;
  const directTrig = ["sin", "cos", "tan"];
  let result = algebrite;
  for (const fn of directTrig) {
    result = wrapFunctionArgsWithDegToRad(result, fn);
  }
  return result;
}

/** Envuelve balanceadamente el argumento de fn(...) en (arg*pi/180) — reemplaza el enfoque de regex frágil del Módulo 1. */
function wrapFunctionArgsWithDegToRad(expr: string, fnName: string): string {
  let result = "";
  let i = 0;
  while (i < expr.length) {
    if (expr.startsWith(`${fnName}(`, i)) {
      const start = i + fnName.length;
      let depth = 1;
      let j = start + 1;
      while (j < expr.length && depth > 0) {
        if (expr[j] === "(") depth++;
        else if (expr[j] === ")") depth--;
        j++;
      }
      const arg = expr.slice(start + 1, j - 1);
      result += `${fnName}((${arg})*pi/180)`;
      i = j;
    } else {
      result += expr[i];
      i++;
    }
  }
  return result;
}

/**
 * Parser completo de sintaxis de entrada (Módulo 2). Lanza AppError con
 * ErrorCode.PARSE_ERROR ante cualquier violación de las reglas de la spec.
 */
export function parseExpression(
  latex: string,
  angleMode: "RAD" | "GRAD" = "RAD",
): ParsedExpression {
  const preprocessed = preprocessLatex(latex);
  const unicodeNormalized = normalizeUnicode(preprocessed);
  validateDecimalPoints(unicodeNormalized);

  const { left, right, isEquation } = splitEquation(unicodeNormalized);

  function pipelineOneSide(side: string): { algebrite: string; tokens: Token[] } {
    const tokens = expandPostfixOperators(tokenize(side));
    validateFunctionArity(tokens);
    const withImplicitMul = insertImplicitMultiplication(tokens);
    const algebrite = rewriteCombinatorics(applyAngleMode(tokensToAlgebrite(withImplicitMul), angleMode));
    return { algebrite, tokens: withImplicitMul };
  }

  const leftResult = pipelineOneSide(left);
  const freeVariables = extractFreeVariables(leftResult.tokens);

  if (!isEquation) {
    return {
      algebrite: leftResult.algebrite,
      isEquation: false,
      freeVariables,
      leftAlgebrite: leftResult.algebrite,
      rightAlgebrite: "0",
    };
  }

  const rightResult = pipelineOneSide(right);
  for (const v of extractFreeVariables(rightResult.tokens)) freeVariables.push(v);

  return {
    algebrite: `(${leftResult.algebrite})-(${rightResult.algebrite})`,
    isEquation: true,
    freeVariables: [...new Set(freeVariables)],
    leftAlgebrite: leftResult.algebrite,
    rightAlgebrite: rightResult.algebrite,
  };
}

export { KNOWN_FUNCTION_NAMES };
