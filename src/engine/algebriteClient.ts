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

/** Deriva una expresión respecto a una variable, orden 1-3 (spec v10 §7). */
export function derivative(expressionAlgebrite: string, variable: string, order: 1 | 2 | 3 = 1): string {
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

export { ErrorCode };
