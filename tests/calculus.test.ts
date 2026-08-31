import { describe, it, expect } from "vitest";
import { compileNumeric, simpsonIntegral, numericLimit, numericLimitAtInfinity } from "../src/engine/numericFallback";
import { calcDefiniteIntegral } from "../src/engine/stepEngine/calculus";

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
