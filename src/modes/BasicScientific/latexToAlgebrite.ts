// TODO (Módulo 2B, según plan de fases de la spec v10): esta es una
// conversión MÍNIMA para que el Módulo 1 tenga un modo básico funcional de
// punta a punta. No implementa todavía: multiplicación implícita completa,
// validación de aridad de log/ln, ni el tratamiento estricto de errores de
// sintaxis que exige la spec §3 (sintaxis de entrada, heredada de v9). No
// usar esta función como referencia de la spec final — es un placeholder
// deliberado y declarado.

export function latexToAlgebrite(latex: string, angleMode: "RAD" | "GRAD"): string {
  let expr = latex
    .replace(/\\times/g, "*")
    .replace(/\\div/g, "/")
    .replace(/\\cdot/g, "*")
    .replace(/\\pi/g, "pi")
    .replace(/\\sqrt\[n\]\{([^}]*)\}/g, "($1)^(1/n)") // ⁿ√ raíz — placeholder simple
    .replace(/\\sqrt\{([^}]*)\}/g, "sqrt($1)")
    .replace(/\\left\|/g, "abs(")
    .replace(/\\right\|/g, ")")
    .replace(/\\ln\(/g, "log(")
    .replace(/\\log\(/g, "log10(")
    .replace(/\\sin\^\{-1\}/g, "arcsin")
    .replace(/\\cos\^\{-1\}/g, "arccos")
    .replace(/\\tan\^\{-1\}/g, "arctan")
    .replace(/\\sin/g, "sin")
    .replace(/\\cos/g, "cos")
    .replace(/\\tan/g, "tan")
    .replace(/\^\{([^}]*)\}/g, "^($1)")
    .replace(/\s+/g, "");

  if (angleMode === "GRAD") {
    // Conversión de grados sexagesimales a radianes dentro de trig directas
    // — alcance exacto según spec v10 §5 (RAD/GRAD = radianes/sexagesimales,
    // DEDUCIBLE, no gradianes). Implementación mínima: envuelve el argumento
    // de sin/cos/tan en (arg * pi/180).
    expr = expr.replace(/(sin|cos|tan)\(([^)]*)\)/g, "$1(($2)*pi/180)");
  }

  return expr;
}
