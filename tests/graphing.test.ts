import { describe, it, expect } from "vitest";
import { analyzeGraph } from "../src/engine/stepEngine/graphing";

// NO EJECUTADO en el entorno de generación. Correr con `npm run test`.
// Estos casos usan una parábola simple porque su comportamiento es
// completamente conocido de antemano — sirve como prueba de referencia
// clara para el análisis numérico.

describe("analyzeGraph", () => {
  it("detecta el vértice de x^2-4 en (0,-4)", () => {
    const analysis = analyzeGraph("x^2-4", "x", [-10, 10]);
    expect(analysis.vertex).not.toBeNull();
    expect(analysis.vertex!.x).toBeCloseTo(0, 1);
    expect(analysis.vertex!.y).toBeCloseTo(-4, 1);
  });

  it("detecta las dos intercepciones en x de x^2-4 (x=-2 y x=2)", () => {
    const analysis = analyzeGraph("x^2-4", "x", [-10, 10]);
    const rounded = analysis.xIntercepts.map((x) => Math.round(x));
    expect(rounded).toContain(-2);
    expect(rounded).toContain(2);
  });

  it("detecta la intercepción en y de x^2-4 (y=-4)", () => {
    const analysis = analyzeGraph("x^2-4", "x", [-10, 10]);
    expect(analysis.yIntercept).toBeCloseTo(-4, 1);
  });

  it("detecta un mínimo global en x=0 para x^2-4", () => {
    const analysis = analyzeGraph("x^2-4", "x", [-10, 10]);
    expect(analysis.globalMin?.x).toBeCloseTo(0, 1);
  });

  it("no detecta vértice para una función no cuadrática (sin(x))", () => {
    const analysis = analyzeGraph("sin(x)", "x", [-10, 10]);
    expect(analysis.vertex).toBeNull();
  });

  it("rechaza una ventana con \"desde\" igual a \"hasta\" (bug detectado en revisión: antes producía división entre cero en el dibujo)", () => {
    expect(() => analyzeGraph("x^2", "x", [5, 5])).toThrow();
  });

  it("no lanza excepción con una ventana muy angosta (caso límite, no igual)", () => {
    expect(() => analyzeGraph("x^2", "x", [-0.001, 0.001])).not.toThrow();
  });
});
