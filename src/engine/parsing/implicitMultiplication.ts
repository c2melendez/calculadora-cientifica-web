// Etapa 6 (spec v9 §3): inserta "*" explícito entre tokens adyacentes que
// implican multiplicación implícita, DESPUÉS de que los identificadores ya
// fueron clasificados (etapa 5) — por eso "theta" nunca se parte, pero
// "2theta" sí se vuelve "2*theta", y "theta*x" queda sin cambios porque el
// "*" ya es explícito en el token de operador.

import type { Token } from "./tokenize";

function endsExpressionAtom(t: Token): boolean {
  return t.type === "number" || t.type === "identifier" || t.type === "rparen";
}

function startsExpressionAtom(t: Token): boolean {
  return (
    t.type === "number" ||
    t.type === "identifier" ||
    t.type === "function" ||
    t.type === "lparen"
  );
}

export function insertImplicitMultiplication(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const curr = tokens[i];
    out.push(curr);
    const next = tokens[i + 1];
    if (!next) continue;

    if (endsExpressionAtom(curr) && startsExpressionAtom(next)) {
      // Excepción: "identificador(" donde el identificador es una función
      // conocida NO es multiplicación — es una llamada. Esto ya está
      // resuelto porque las funciones se tokenizan con type "function", que
      // no cumple endsExpressionAtom ni pasa por aquí como "curr" en ese rol.
      out.push({ type: "operator", value: "*" });
    }
  }
  return out;
}
