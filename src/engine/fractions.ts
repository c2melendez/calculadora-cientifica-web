// Capa de fracciones exactas — spec v10 §11. Todo resultado racional pasa
// por aquí antes de llegar a la UI.

import Fraction from "fraction.js";
import type { FractionResult } from "../types";

const MAX_DECIMAL_DIGITS = 10;

/** Convierte un número o fracción decimal ("3/4", "1.5", 2) al contrato FractionResult. */
export function toFractionResult(value: string | number): FractionResult {
  const f = new Fraction(value);
  const improperLatex = `\\frac{${f.n}}{${f.d}}`;

  let mixedLatex: string | null = null;
  const absN = Math.abs(f.n);
  if (absN >= f.d && f.d !== 1) {
    const whole = Math.floor(absN / f.d) * Math.sign(f.n);
    const remainder = absN % f.d;
    mixedLatex =
      remainder === 0
        ? `${whole}`
        : `${whole}\\ \\frac{${remainder}}{${f.d}}`;
  }

  let decimalStr = f.toString(MAX_DECIMAL_DIGITS);
  // Fraction.js repite el período con paréntesis, ej "0.(3)"; para el
  // requisito de UI ("truncar a 10 dígitos e indicar con …", spec §11) se
  // convierte esa notación a truncamiento + puntos suspensivos.
  if (decimalStr.includes("(")) {
    const truncated = f.valueOf().toFixed(MAX_DECIMAL_DIGITS);
    decimalStr = `${truncated}…`;
  }

  return { improperLatex, mixedLatex, decimal: decimalStr };
}

/** Fase 1 (fusión de modos — router evaluate/ecuación/sistema en una sola
 * pantalla): LaTeX compacto para un Fraction.js ya simplificado — entero
 * sin \frac cuando el denominador es 1, fracción apilada en el resto de
 * los casos. Se agrega ahora porque handleLinearSystem (compute.worker.ts)
 * pasa a ser alcanzable desde la pantalla unificada de BasicScientificMode,
 * que ya renderiza resultLatex como LaTeX real (Fase E) — sin esto, "x = 12"
 * se vería como "x = \frac{12}{1}" en vez de "x = 12". */
export function fractionToLatex(f: Fraction): string {
  return f.d === 1 ? `${f.n}` : `\\frac{${f.n}}{${f.d}}`;
}
