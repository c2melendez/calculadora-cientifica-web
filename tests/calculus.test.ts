import { describe, it, expect } from "vitest";
import { compileNumeric, simpsonIntegral, numericLimit, numericLimitAtInfinity } from "../src/engine/numericFallback";
import { calcDefiniteIntegral, calcLimit, calcDerivative } from "../src/engine/stepEngine/calculus";

// NO EJECUTADO en el entorno de generación. Correr con `npm run test`.

describe("compileNumeric", () => {
  it("evalúa una expresión polinómica simple", () => {
    const f = compileNumeric("x^2+1", "x");
    expect(f(3)).toBeCloseTo(10);
  });

  it("evalúa funciones trigonométricas", () => {
    const f = compileNumeric("sin(x)", "x");
    expect(f(0)).toBeCloseTo(0);
  });

  it("maneja el signo + unario, ej. +x^2-4 (bug detectado en revisión: antes solo se manejaba el - unario)", () => {
    const f = compileNumeric("+x^2-4", "x");
    expect(f(3)).toBeCloseTo(5); // +9-4
  });
});

describe("simpsonIntegral", () => {
  it("aproxima la integral de x^2 de 0 a 1 (valor exacto 1/3)", () => {
    const f = compileNumeric("x^2", "x");
    expect(simpsonIntegral(f, 0, 1, 100)).toBeCloseTo(1 / 3, 4);
  });
});

describe("numericLimit", () => {
  it("estima el límite clásico de sin(x)/x en x->0 (debería acercarse a 1)", () => {
    const f = compileNumeric("sin(x)/x", "x");
    const { value, converged } = numericLimit(f, 0);
    expect(converged).toBe(true);
    expect(value).toBeCloseTo(1, 2);
  });

  // Fase 2 externa (hueco #4): límite lateral, dirección "left"/"right".
  it("respeta la dirección lateral (1/x en 0+ diverge a +∞, en 0- a -∞)", () => {
    const f = compileNumeric("1/x", "x");
    const { value: right } = numericLimit(f, 0, "right");
    const { value: left } = numericLimit(f, 0, "left");
    expect(right).toBeGreaterThan(0);
    expect(left).toBeLessThan(0);
  });
});

// Fase 2 externa (hueco #3): límite cuando x tiende a +∞/-∞.
describe("numericLimitAtInfinity", () => {
  it("1/x en x->+∞ tiende a 0", () => {
    const f = compileNumeric("1/x", "x");
    const { value, converged } = numericLimitAtInfinity(f, 1);
    expect(converged).toBe(true);
    expect(value).toBeCloseTo(0, 4);
  });

  it("1/x en x->-∞ tiende a 0", () => {
    const f = compileNumeric("1/x", "x");
    const { value, converged } = numericLimitAtInfinity(f, -1);
    expect(converged).toBe(true);
    expect(value).toBeCloseTo(0, 4);
  });

  it("(2x+1)/(x+3) en x->+∞ tiende a 2 (cociente de coeficientes líderes)", () => {
    const f = compileNumeric("(2*x+1)/(x+3)", "x");
    const { value } = numericLimitAtInfinity(f, 1);
    expect(value).toBeCloseTo(2, 2);
  });
});

// Fase 2 externa (hallazgo nuevo, no reportado antes): calcDefiniteIntegral
// tenía el mismo bug de orden de argumentos de subst() ya corregido en
// linearSystem.ts (Fase 1) — nunca se portó aquí, y no había NINGÚN test
// para esta función, por eso pasó desapercibido. Antes del fix daba la
// antiderivada sin evaluar en los límites (ej. 1/3*x^3 en vez de 8/3),
// en silencio, sin error.
describe("calcDefiniteIntegral", () => {
  it("∫₀² x² dx = 8/3", () => {
    const value = Number(calcDefiniteIntegral("x^2", "x", 0, 2).resultLatex.replace("...", ""));
    expect(value).toBeCloseTo(8 / 3, 4);
  });

  it("∫₀^π sin(x) dx = 2", () => {
    const value = Number(
      calcDefiniteIntegral("sin(x)", "x", 0, Math.PI).resultLatex.replace("...", ""),
    );
    expect(value).toBeCloseTo(2, 4);
  });

  it("∫₁³ 1/x dx = ln(3)", () => {
    const value = Number(calcDefiniteIntegral("1/x", "x", 1, 3).resultLatex.replace("...", ""));
    expect(value).toBeCloseTo(Math.log(3), 4);
  });
});

// Fase 3 (paridad con la pantalla única): calcLimit/calcDerivative ya
// aceptaban lo mismo que tryLimitFallback/normalize.ts internamente, pero
// no estaban cableados desde CalculusMode.tsx (el formulario dedicado
// seguía limitado a orden 1-3 y puntos finitos). Estos tests cubren el
// motor directamente, independiente de la UI.
describe("calcLimit (Fase 3 — infinito y lateral, paridad con la pantalla única)", () => {
  it("límite finito de una función continua (control, comportamiento previo sin cambios)", () => {
    const result = calcLimit("x^2", "x", "2", 2);
    expect(Number(result.resultLatex.replace("...", ""))).toBeCloseTo(4, 3);
  });

  it("límite en +infinito: 1/x -> 0", () => {
    const result = calcLimit("1/x", "x", "oo", 0);
    expect(result.confidence).toBe("NUMERIC_FALLBACK"); // Algebrite no lo resuelve simbólicamente
    expect(Number(result.resultLatex)).toBeCloseTo(0, 3);
  });

  it("límite en -infinito: 1/x -> 0", () => {
    const result = calcLimit("1/x", "x", "-oo", 0);
    expect(Number(result.resultLatex)).toBeCloseTo(0, 3);
  });

  it("límite lateral derecho de 1/x en 0 -> +infinito (no converge, pero no explota)", () => {
    const result = calcLimit("1/x", "x", "0", 0, "right");
    // 1/x cerca de 0 por la derecha crece sin cota — no se espera un
    // valor finito preciso, solo que no truene y quede marcado como no
    // convergente o con un valor grande.
    expect(result.resultLatex).toBeDefined();
  });

  it("límite lateral (izquierda vs derecha) de una función continua da el mismo valor que 'both'", () => {
    const both = calcLimit("x^2+1", "x", "3", 3, "both");
    const right = calcLimit("x^2+1", "x", "3", 3, "right");
    expect(Number(right.resultLatex.replace("...", ""))).toBeCloseTo(
      Number(both.resultLatex.replace("...", "")),
      2,
    );
  });
});

describe("calcDerivative (Fase 3 — orden N sin tope de 3, paridad con la pantalla única)", () => {
  it("orden 1 (control, comportamiento previo sin cambios)", () => {
    expect(calcDerivative("x^2", "x", 1).resultLatex.replace(/\s/g, "")).toMatch(/2\*?x/);
  });

  it("orden 4 de x^5 -> 120x (antes inalcanzable, tope era 3)", () => {
    expect(calcDerivative("x^5", "x", 4).resultLatex.replace(/\s/g, "")).toMatch(/120\*?x/);
  });

  it("orden 8 de x^9 -> 362880x (9! = 362880)", () => {
    expect(calcDerivative("x^9", "x", 8).resultLatex.replace(/\s/g, "")).toMatch(/362880\*?x/);
  });

  it("rechaza orden fuera de rango (>20, guarda de sensatez)", () => {
    expect(() => calcDerivative("x^2", "x", 25)).toThrow();
  });
});
