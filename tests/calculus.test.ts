import { describe, it, expect } from "vitest";
import { compileNumeric, simpsonIntegral, numericLimit } from "../src/engine/numericFallback";

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
});
