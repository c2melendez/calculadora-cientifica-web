// Fase 1 (fusión de modos, plan de 3 fases — spec UX estilo ClassCalc):
// detecta si el LaTeX del campo único de BasicScientificMode contiene un
// entorno \begin{cases}...\end{cases} — el que inserta el ícono de
// sistema del teclado (MathKeyboard.tsx, "onSolveSystem") — y lo separa
// en ecuaciones individuales, una por renglón, para que el router de
// BasicScientificMode pueda tratarlo como un sistema en vez de una
// expresión simple.
//
// MathLive soporta el entorno `cases` de forma nativa (confirmado contra
// su changelog público: soporte para agregar/quitar renglones dentro de
// un entorno cases), así que no hace falta ningún parseo LaTeX propio más
// allá de separar por el separador de renglón "\\" — cada renglón se
// vuelve a pasar por parseExpression() tal cual, igual que hace
// LinearSystemsMode.tsx hoy con sus N campos separados.
//
// DEDUCIBLE (fuera de alcance de esta fase, a propósito): un sistema
// escrito a mano sin el entorno cases (ej. "x=1; y=2" con punto y coma)
// es ambiguo — ¿son dos ecuaciones de un sistema o dos afirmaciones
// sueltas que casualmente comparten renglón? Se deja fuera hasta que haya
// una decisión explícita al respecto.

const CASES_PATTERN = /\\begin\{cases\}([\s\S]*?)\\end\{cases\}/;

/**
 * Devuelve las ecuaciones de un entorno `cases` como LaTeX individual por
 * renglón, o `null` si `latex` no contiene ese entorno (o contiene menos
 * de 2 renglones no vacíos, que no alcanza para un sistema).
 */
export function splitSystemLatex(latex: string): string[] | null {
  const match = CASES_PATTERN.exec(latex);
  if (!match) return null;

  const rows = match[1]
    .split("\\\\")
    .map((row) => row.trim())
    .filter((row) => row.length > 0);

  return rows.length >= 2 ? rows : null;
}
