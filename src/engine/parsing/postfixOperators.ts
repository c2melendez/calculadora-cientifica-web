// Fase 3 de la hoja de ruta ("motor científico completo"): expande los
// operadores postfijos ! (factorial) y % (porcentaje, /100) en su forma
// explícita de función/división ANTES de insertImplicitMultiplication.
//
// Por qué antes y no después: si corriera después de la multiplicación
// implícita, una expresión como "50%x" o "5!x" no obtendría el "*" que
// necesita, porque en el momento en que se decide la multiplicación
// implícita, "%"/"!" todavía no se habrían convertido en un grupo que
// termina en ")" o en un número — insertImplicitMultiplication no sabe
// reconocer un operador postfijo como "fin de átomo". Al expandirlos
// primero a "(factorial(x))" / "(x)/100", el resultado ya termina en un
// token que insertImplicitMultiplication sí reconoce (rparen o number),
// así que la multiplicación implícita funciona sin tocar su lógica.
//
// "!" se expande a factorial(...) en vez de dejarse como "!" nativo de
// Algebrite por la misma razón: uniformidad de un solo mecanismo para
// ambos operadores postfijos, en vez de dos rutas de código distintas.

import type { Token } from "./tokenize";

const POSTFIX_OPERATORS = new Set(["!", "%"]);

/**
 * Encuentra el inicio del "átomo" inmediatamente anterior a `index` (el
 * operando al que se aplica el operador postfijo): un solo token (número
 * o identificador), o un grupo paréntesis-balanceado completo —
 * incluyendo el nombre de función si el paréntesis cierra una llamada
 * como sin(x). No cruza operadores binarios ni comas.
 */
function findAtomStart(tokens: Token[], index: number): number {
  const prev = tokens[index - 1];
  if (!prev) return index; // nada que envolver (expresión inválida, se deja para que Algebrite falle)

  if (prev.type === "rparen") {
    let depth = 1;
    let j = index - 2;
    while (j >= 0 && depth > 0) {
      if (tokens[j].type === "rparen") depth++;
      else if (tokens[j].type === "lparen") depth--;
      j--;
    }
    const lparenIndex = j + 1;
    // Si justo antes del "(" hay un nombre de función (sin, cos, factorial...),
    // el átomo incluye la función completa: sin(x)! es (sin(x))!, no sin((x)!).
    if (lparenIndex > 0 && tokens[lparenIndex - 1].type === "function") {
      return lparenIndex - 1;
    }
    return lparenIndex;
  }

  // Número o identificador sueltos: átomo de un solo token.
  return index - 1;
}

export function expandPostfixOperators(tokens: Token[]): Token[] {
  const result: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== "operator" || !POSTFIX_OPERATORS.has(t.value)) {
      result.push(t);
      continue;
    }

    const atomStart = findAtomStart(result, result.length);
    const atom = result.splice(atomStart, result.length - atomStart);

    if (t.value === "!") {
      result.push(
        { type: "function", value: "factorial" },
        { type: "lparen", value: "(" },
        ...atom,
        { type: "rparen", value: ")" },
      );
    } else {
      // "%": (atom)/100
      result.push(
        { type: "lparen", value: "(" },
        ...atom,
        { type: "rparen", value: ")" },
        { type: "operator", value: "/" },
        { type: "number", value: "100" },
      );
    }
  }

  return result;
}
