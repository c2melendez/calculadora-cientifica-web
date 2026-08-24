import { describe, it, expect } from "vitest";
import { gaussJordan, toFractionMatrix } from "../src/engine/matrixOps";
import { solveLinearSystem } from "../src/engine/stepEngine/linearSystem";
import { parseExpression } from "../src/engine/parsing";

// NO EJECUTADO en el entorno de generación. Correr con `npm run test`.

describe("gaussJordan", () => {
  it("resuelve un sistema 2x2 con solución única: x+y=3, x-y=1 -> x=2,y=1", () => {
    const augmented = toFractionMatrix([
      [1, 1, 3],
      [1, -1, 1],
    ]);
    const solution = gaussJordan(augmented, ["x", "y"]);
    expect(solution.kind).toBe("unique");
    expect(solution.values?.map((v) => v.toFraction())).toEqual(["2", "1"]);
  });

  it("detecta sistema inconsistente: x+y=1, x+y=2", () => {
    const augmented = toFractionMatrix([
      [1, 1, 1],
      [1, 1, 2],
    ]);
    expect(gaussJordan(augmented, ["x", "y"]).kind).toBe("none");
  });

  it("detecta infinitas soluciones: x+y=2, 2x+2y=4", () => {
    const augmented = toFractionMatrix([
      [1, 1, 2],
      [2, 2, 4],
    ]);
    expect(gaussJordan(augmented, ["x", "y"]).kind).toBe("infinite");
  });
});

describe("solveLinearSystem (integración con el parser)", () => {
  it("resuelve 2x+y=5, x-y=1 usando ecuaciones en LaTeX/Algebrite reales", () => {
    const eq1 = parseExpression("2x+y=5").algebrite;
    const eq2 = parseExpression("x-y=1").algebrite;
    const solution = solveLinearSystem([eq1, eq2], ["x", "y"]);
    expect(solution.kind).toBe("unique");
  });

  it("rechaza un sistema no lineal (término x*y)", () => {
    const eq1 = parseExpression("x*y+y=5").algebrite;
    const eq2 = parseExpression("x-y=1").algebrite;
    expect(() => solveLinearSystem([eq1, eq2], ["x", "y"])).toThrow();
  });
});
