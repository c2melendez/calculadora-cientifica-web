import { describe, it, expect } from "vitest";
import { parseExpression } from "../src/engine/parsing";
import { solveAlgebra } from "../src/engine/stepEngine/algebra";

// NO EJECUTADO en el entorno de generación (sin red para instalar
// Algebrite/Vitest). Correr con `npm run test` tras `npm install`.

describe("Modo Álgebra (Módulo 3)", () => {
  it("resuelve una ecuación lineal simple: 2x+3=7 -> x=2", () => {
    const parsed = parseExpression("2x+3=7");
    expect(parsed.isEquation).toBe(true);
    expect(parsed.freeVariables).toEqual(["x"]);

    const { solutionsAlgebrite } = solveAlgebra(
      parsed.leftAlgebrite,
      parsed.rightAlgebrite,
      "x",
    );
    expect(solutionsAlgebrite).toContain("2");
  });

  it("una expresión sin = se marca isEquation:false y no debe pasar a solveAlgebra", () => {
    const parsed = parseExpression("2x+3");
    expect(parsed.isEquation).toBe(false);
  });

  it("detecta correctamente dos variables libres (x, y) para rechazo en la UI", () => {
    const parsed = parseExpression("x+y=5");
    expect(parsed.freeVariables.sort()).toEqual(["x", "y"]);
  });
});
