// Único punto de contacto con Algebrite en todo el proyecto (regla de capa
// dura, spec v10 §3). Ningún componente de /modes o /components debe hacer
// `import Algebrite from "algebrite"` directamente.
//
// NOTA: "algebrite" no publica tipos de TypeScript. Se probaron DOS formas
// de declaración ambiental (`declare module "algebrite" { ... }` con firma
// completa, y luego la forma shorthand `declare module "algebrite";`) y
// NINGUNA de las dos fue honrada por el compilador real en GitHub Actions
// — seguía reportando TS7016 en la línea del import, pese a que el archivo
// .d.ts estaba presente y confirmado en el repo. No se pudo determinar la
// causa exacta sin acceso directo al entorno de CI para depurar la
// resolución de módulos. Se abandona ese mecanismo y se usa `@ts-ignore`
// directamente sobre el import: es la técnica estándar para paquetes sin
// tipos y no depende de que TypeScript descubra ninguna declaración
// ambiental, así que es inmune al problema anterior. Efecto: `Algebrite`
// queda tipado `any` — por eso CADA llamada de abajo anota explícitamente
// `: string` en la variable que recibe el resultado, para que ese `any` no
// se cuele en callbacks downstream (ej. `.map()`) sin que noImplicitAny lo
// detecte.
// @ts-ignore -- 'algebrite' no tiene declaración de tipos, ver nota arriba
import Algebrite from "algebrite";
import { ErrorCode, type AppError } from "../types";

function toAppError(code: ErrorCode, message: string): AppError {
  return { code, message };
}

/**
 * Fase 3: sinh/cosh/tanh (entre otras) quedan sin evaluar simbólicamente
 * en Algebrite salvo que se envuelvan en float(...) — confirmado probando
 * el paquete real, no asumido. asinh/acosh/atanh/sign NO los evalúa
 * Algebrite ni siquiera con float() (también confirmado); para esos,
 * quien llama a evaluate() debe recurrir al fallback numérico propio
 * (engine/numericFallback.ts) si el resultado los sigue conteniendo.
 */
const MAY_NEED_FLOAT = /\b(sinh|cosh|tanh|asinh|acosh|atanh|sign)\(/;

/** Evalúa/simplifica una expresión. Lanza AppError normalizado en caso de fallo. */
export function evaluate(expressionLatex: string): string {
  try {
    // Algebrite trabaja con su propia sintaxis de entrada; la conversión
    // LaTeX -> sintaxis Algebrite vive en engine/parsing (Módulo 2).
    let result: string = Algebrite.run(expressionLatex);
    if (typeof result !== "string" || result.length === 0) {
      throw toAppError(ErrorCode.PARSE_ERROR, "Algebrite no devolvió resultado.");
    }
    if (/stop|Stop/.test(result)) {
      throw toAppError(ErrorCode.PARSE_ERROR, `Algebrite reportó un error: ${result}`);
    }
    if (MAY_NEED_FLOAT.test(result)) {
      const retried: string = Algebrite.run(`float(${expressionLatex})`);
      if (typeof retried === "string" && retried.length > 0 && !/stop|Stop/.test(retried)) {
        result = retried;
      }
    }
    return result;
  } catch (err) {
    if ((err as AppError).code) throw err;
    throw toAppError(ErrorCode.PARSE_ERROR, `Fallo inesperado al evaluar: ${String(err)}`);
  }
}

/**
 * Deriva una expresión respecto a una variable, orden N (spec v10 §7,
 * Fase 3: paridad con la pantalla única — normalize.ts ya acepta
 * cualquier N en \frac{d^N}{dx^N} escrito a mano, este formulario no
 * debería quedar más limitado). Guarda de sensatez en 20: un loop de
 * `d()` de cientos de vueltas no tiene utilidad matemática real y sí
 * puede colgar el worker con expresiones grandes.
 */
export function derivative(expressionAlgebrite: string, variable: string, order: number = 1): string {
  if (!Number.isInteger(order) || order < 1 || order > 20) {
    throw toAppError(ErrorCode.COMPLEXITY_LIMIT, `Orden de derivada fuera de rango (1-20): ${order}.`);
  }
  try {
    let expr: string = expressionAlgebrite;
    for (let i = 0; i < order; i++) {
      expr = Algebrite.run(`d(${expr},${variable})`);
    }
    return expr;
  } catch (err) {
    throw toAppError(ErrorCode.COMPLEXITY_LIMIT, `No se pudo derivar de orden ${order}: ${String(err)}`);
  }
}

/** Resuelve una ecuación de una variable. */
export function solveEquation(equationAlgebrite: string, variable: string): string[] {
  try {
    const result: string = Algebrite.run(`roots(${equationAlgebrite},${variable})`);
    if (/stop|Stop/.test(result)) {
      throw toAppError(ErrorCode.UNSUPPORTED_OPERATION, `No se pudo resolver: ${result}`);
    }
    // Algebrite devuelve un vector de raíces separadas por coma cuando hay
    // más de una; se normaliza a array de strings.
    return result
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((s: string) => s.trim());
  } catch (err) {
    if ((err as AppError).code) throw err;
    throw toAppError(ErrorCode.UNSUPPORTED_OPERATION, `Fallo al resolver ecuación: ${String(err)}`);
  }
}

/** Integral indefinida — best-effort, spec v10 §7 (Algebrite no cubre todo lo que SymPy). */
export function indefiniteIntegral(expressionAlgebrite: string, variable: string): string {
  try {
    const result: string = Algebrite.run(`integral(${expressionAlgebrite},${variable})`);
    if (typeof result !== "string" || /stop|Stop|integral\(/.test(result)) {
      throw toAppError(ErrorCode.UNSUPPORTED_OPERATION, "Algebrite no pudo resolver esta integral.");
    }
    return result;
  } catch (err) {
    if ((err as AppError).code) throw err;
    throw toAppError(ErrorCode.UNSUPPORTED_OPERATION, `No se pudo integrar: ${String(err)}`);
  }
}

/** Límite simbólico — best-effort; no se asume que Algebrite siempre lo resuelva (ver README, riesgos). */
export function symbolicLimit(expressionAlgebrite: string, variable: string, point: string): string {
  try {
    const result: string = Algebrite.run(`limit(${expressionAlgebrite},${variable},${point})`);
    if (typeof result !== "string" || /stop|Stop|limit\(/.test(result)) {
      throw toAppError(ErrorCode.UNSUPPORTED_OPERATION, "Algebrite no pudo resolver este límite simbólicamente.");
    }
    return result;
  } catch (err) {
    if ((err as AppError).code) throw err;
    throw toAppError(ErrorCode.UNSUPPORTED_OPERATION, `Fallo al calcular límite simbólico: ${String(err)}`);
  }
}

/**
 * Fase E (fix display, detectado por comparación visual con ClassCalc):
 * TODAS las funciones de arriba devuelven la sintaxis nativa de impresión
 * de Algebrite (ej. "7^(1/2)", "1/2*2^(1/2)") — NUNCA LaTeX real, pese a
 * que en todo el proyecto ese string se asigna al campo `resultLatex`.
 * Algebrite sí trae su propio conversor a LaTeX vía el comando interno
 * `printlatex()` (confirmado contra el paquete real y la documentación de
 * la librería). Se envuelve el resultado ya evaluado en `quote(...)` para
 * que printlatex lo formatee sin volver a simplificarlo/reevaluarlo.
 *
 * Esta función es el único punto donde se hace esa conversión — los
 * llamadores (compute.worker.ts) deben pasar por acá antes de escribir
 * `resultLatex` en un MathResult. Si la conversión falla por cualquier
 * motivo, se devuelve el string original de Algebrite como fallback: es
 * mejor mostrar la sintaxis nativa que un campo vacío.
 */
export function toLatex(algebriteResult: string): string {
  try {
    const latex: string = Algebrite.run(`printlatex(quote(${algebriteResult}))`);
    if (typeof latex !== "string" || latex.length === 0 || /stop|Stop/.test(latex)) {
      return algebriteResult;
    }
    return latex;
  } catch {
    return algebriteResult;
  }
}

/**
 * Fase E: aproximación decimal forzada de un resultado ya evaluado, para
 * cuando NO matchea el regex de "número puro" de compute.worker.ts (ej.
 * sin(pi/4) evalúa a "2^(1/2)/2", que es simbólico, no un número/fracción
 * literal) — sin esto, la pestaña "dec" de ResultPanel repetía el mismo
 * string simbólico que "sqrt" en vez de mostrar 0.7071. Devuelve null si
 * Algebrite no puede reducirlo a float (ej. contiene variables libres).
 */
export function toDecimalApprox(algebriteResult: string): string | null {
  try {
    const floated: string = Algebrite.run(`float(${algebriteResult})`);
    if (typeof floated !== "string" || floated.length === 0 || /stop|Stop/.test(floated)) {
      return null;
    }
    // Verificado contra el paquete real: float() trunca decimales
    // periódicos con "..." literal al final (ej. "0.707107..." para
    // sin(pi/4)) — el mismo caso que fractions.ts ya maneja para
    // Fraction.js, pero con notación distinta ("..." vs "…"). Se
    // normaliza acá a la misma elipsis unicode que usa fractions.ts, para
    // que ResultPanel no tenga que distinguir el origen del decimal.
    const normalized = floated.replace(/\.\.\.$/, "…");
    // Si float() no pudo reducir nada (ej. queda una variable libre 'x'),
    // Algebrite devuelve la expresión sin cambios — en ese caso no hay
    // aproximación real que mostrar.
    if (!/^-?\d+(\.\d+)?(…)?([eE][-+]?\d+)?$/.test(normalized)) return null;
    return normalized;
  } catch {
    return null;
  }
}

export { ErrorCode };
