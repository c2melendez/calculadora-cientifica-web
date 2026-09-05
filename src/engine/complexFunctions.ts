// P4 (spec v2 §5.1): Re()/Im()/arg()/conj()/topolar() para números
// complejos.
//
// No pude ejecutar `Algebrite.run("(2+3*i)*(1-i)")` en este entorno (sin
// red, sin node_modules instalados) para confirmar si Algebrite resuelve
// re/im/arg/conjugate nativamente, como pide verificar la spec (§5.1).
// Sin esa confirmación empírica, tomo la ruta de fallback que la propia
// spec describe para el caso "no": JS puro, mismo criterio que
// statFunctions.ts (que SÍ confirmó, probando el paquete real, que
// Algebrite carece de mean/median/etc. — ver su cabecera). Documentado
// como riesgo pendiente en el cierre del P4, no como hecho confirmado —
// si Algebrite sí las soporta nativamente, este módulo sigue funcionando
// igual (nunca le pregunta a Algebrite por re/im/arg directamente, solo
// usa evaluate() para simplificar la expresión de entrada primero).
//
// Alcance (igual que statFunctions.ts): la función debe ser la expresión
// COMPLETA, no anidada dentro de otra (ej. "re(2+3*i)" sí, "re(2+3*i)+1"
// no, todavía).
//
// Limitación conocida: solo reconoce el resultado ya reducido por
// Algebrite a la forma canónica de un término real + un término
// imaginario (ej. "5+3*i", "2-i", "4*i", "7") — no una suma sin combinar
// de varios términos con i. Algebrite normalmente sí combina términos
// semejantes al evaluar, pero no está garantizado para toda expresión de
// entrada; si no puede interpretarlo, lanza un error claro en vez de dar
// un resultado silenciosamente incorrecto.

import { evaluate } from "./algebriteClient";

export const COMPLEX_FUNCTION_NAMES = ["re", "im", "arg", "conj", "topolar"] as const;
export type ComplexFunctionName = (typeof COMPLEX_FUNCTION_NAMES)[number];

function isComplexFunctionName(name: string): name is ComplexFunctionName {
  return (COMPLEX_FUNCTION_NAMES as readonly string[]).includes(name);
}

interface ComplexParts {
  re: number;
  im: number;
}

/** Extrae (re, im) del string ya evaluado por Algebrite. Lanza si no
 * matchea la forma canónica esperada (ver limitación arriba). */
function parseComplex(algebriteResult: string): ComplexParts {
  const s = algebriteResult.replace(/\s+/g, "");

  // Forma pura real (sin "i" como unidad imaginaria — ojo: esto NO
  // detecta "i" dentro de otro identificador porque Algebrite ya evaluó
  // la expresión a una forma numérica en este punto).
  if (!/i/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) throw new Error(`No se pudo interpretar "${s}" como número complejo.`);
    return { re: n, im: 0 };
  }

  // Forma pura imaginaria: "i", "-i", "4*i", "-4*i"
  const pureImagMatch = s.match(/^([+-]?\d*\.?\d*)\*?i$/);
  if (pureImagMatch) {
    const coef = pureImagMatch[1];
    const im = coef === "" || coef === "+" ? 1 : coef === "-" ? -1 : Number(coef);
    if (!Number.isFinite(im)) throw new Error(`No se pudo interpretar "${s}" como número complejo.`);
    return { re: 0, im };
  }

  // Forma combinada: "A+B*i" / "A-B*i" / "A+i" / "A-i", A y B numéricos.
  const combined = s.match(/^([+-]?\d+\.?\d*)([+-])(\d*\.?\d*)\*?i$/);
  if (combined) {
    const [, reStr, sign, imMagStr] = combined;
    const re = Number(reStr);
    const imMag = imMagStr === "" ? 1 : Number(imMagStr);
    if (!Number.isFinite(re) || !Number.isFinite(imMag)) {
      throw new Error(`No se pudo interpretar "${s}" como número complejo.`);
    }
    return { re, im: sign === "-" ? -imMag : imMag };
  }

  throw new Error(
    `"${s}" no tiene la forma A+B*i esperada (probablemente Algebrite no lo redujo del todo) — re()/im()/arg()/conj()/topolar() no pueden procesarlo todavía.`,
  );
}

/** Evita basura de flotantes tipo 2.0000000000000004. */
function formatNumber(n: number): string {
  return Number(n.toPrecision(12)).toString();
}

/**
 * Mismo contrato que tryStatFunction: null si `expr` no es un llamado
 * completo a una de estas funciones (el flujo normal sigue su curso),
 * string con el resultado (sintaxis Algebrite) si sí.
 */
export function tryComplexFunction(expr: string): string | null {
  const match = expr.match(/^([a-zA-Z]+)\((.*)\)$/s);
  if (!match) return null;
  const [, name, argStr] = match;
  if (!isComplexFunctionName(name)) return null;

  const inner = evaluate(argStr.trim());
  const { re, im } = parseComplex(inner);

  switch (name) {
    case "re":
      return formatNumber(re);
    case "im":
      return formatNumber(im);
    case "conj":
      if (im === 0) return formatNumber(re);
      return im > 0 ? `${formatNumber(re)}-${formatNumber(im)}*i` : `${formatNumber(re)}+${formatNumber(-im)}*i`;
    case "arg":
      return formatNumber(Math.atan2(im, re));
    case "topolar": {
      // Representación r*e^(i*theta) — dirección única (rectangular ->
      // polar); no hay sintaxis de entrada polar en este teclado para la
      // dirección inversa (ver cierre del P4).
      const r = Math.hypot(re, im);
      const theta = Math.atan2(im, re);
      return `${formatNumber(r)}*e^(${formatNumber(theta)}*i)`;
    }
    default:
      return null;
  }
}
