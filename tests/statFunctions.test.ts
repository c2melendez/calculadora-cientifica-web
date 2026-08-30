import { describe, it, expect } from "vitest";
import { parseExpression } from "../src/engine/parsing";
import { tryStatFunction } from "../src/engine/statFunctions";
import { ErrorCode } from "../src/types";

// Auditoría Fase 0 v2, hallazgo 1.3 + hallazgo nuevo detectado al corregirlo:
// las teclas del menú "Stat"/"Alg" insertan \mathrm{nombre}\left(...\right)
// (o \gcd/\min/\max, que tampoco son macros que preprocessLatex conociera),
// lo que producía un error de PARSEO ("Carácter no reconocido") antes de
// siquiera llegar a Algebrite — confirmado probando las plantillas LaTeX
// reales del teclado (MathKeyboard.tsx), no solo la sintaxis Algebrite ya
// convertida como hacían las pruebas de nPr/nCr en parsing.test.ts.

describe("Fase 10 — macros \\mathrm/\\gcd/\\min/\\max ya no truenan en el parser", () => {
  it("\\mathrm{mean}\\left(...\\right) parsea a mean(...), no revienta", () => {
    expect(parseExpression("\\mathrm{mean}\\left(1,2,3\\right)").algebrite).toBe("mean(1,2,3)");
  });

  it("\\min\\left(...\\right) y \\max\\left(...\\right) parsean a min(...)/max(...)", () => {
    expect(parseExpression("\\min\\left(1,2,3\\right)").algebrite).toBe("min(1,2,3)");
    expect(parseExpression("\\max\\left(1,2,3\\right)").algebrite).toBe("max(1,2,3)");
  });

  it("\\gcd\\left(...\\right) parsea a gcd(...)", () => {
    expect(parseExpression("\\gcd\\left(4,6\\right)").algebrite).toBe("gcd(4,6)");
  });

  it("no inserta multiplicación implícita entre el nombre y el paréntesis (bug real: mean(1,2,3) se volvía mean*(1,2,3))", () => {
    for (const fn of ["mean", "median", "mode", "min", "max", "range", "sort", "mad"]) {
      expect(parseExpression(`${fn}(1,2,3)`).algebrite).toBe(`${fn}(1,2,3)`);
    }
  });

  it("la tecla \"variance\" en realidad inserta \\mathrm{var} — se acepta var(...) como identificador de función", () => {
    expect(parseExpression("\\mathrm{var}\\left(2,4,6\\right)").algebrite).toBe("var(2,4,6)");
  });

  it("mod/gcd/lcm quedan registrados con aridad 2 (son nativas de Algebrite, no necesitan fallback propio)", () => {
    expect(() => parseExpression("mod(7,3)")).not.toThrow();
    expect(() => parseExpression("gcd(4,6)")).not.toThrow();
    expect(() => parseExpression("lcm(4,6)")).not.toThrow();
    expect(() => parseExpression("mod(7)")).toThrowError(
      expect.objectContaining({ code: ErrorCode.PARSE_ERROR }),
    );
  });
});

describe("Fase 10 — tryStatFunction (evaluación numérica real)", () => {
  it("mean/median/mode calculan correctamente", () => {
    expect(tryStatFunction("mean(1,2,3)")).toBe("2");
    expect(tryStatFunction("median(1,2,3,4)")).toBe("2.5");
    expect(tryStatFunction("mode(1,2,2,3)")).toBe("2");
  });

  it("min/max/range calculan correctamente", () => {
    expect(tryStatFunction("min(5,1,3)")).toBe("1");
    expect(tryStatFunction("max(5,1,3)")).toBe("5");
    expect(tryStatFunction("range(1,2,9)")).toBe("8");
  });

  it("stdev/variance (var) usan desviación MUESTRAL, n-1 (decisión deliberada, ver statFunctions.ts)", () => {
    // datos 2,4,6: media 4, desviaciones -2,0,2, suma de cuadrados 8, /(3-1)=4
    expect(tryStatFunction("var(2,4,6)")).toBe("4");
    expect(tryStatFunction("stdev(2,4,6)")).toBe("2");
  });

  it("sort devuelve la lista ordenada", () => {
    expect(tryStatFunction("sort(3,1,2)")).toBe("[1,2,3]");
  });

  it("mad calcula la desviación absoluta media", () => {
    // datos 1,2,3: media 2, |1-2|+|2-2|+|3-2| = 2, /3 = 0.6666...
    expect(tryStatFunction("mad(1,2,3)")).toBe("0.666666666667");
  });

  it("acepta expresiones como argumentos, no solo literales (ej. mean(2+2, sqrt(9)))", () => {
    expect(tryStatFunction("mean(2+2,sqrt(9))")).toBe("3.5");
  });

  it("stdev/variance con un solo valor lanza error (necesitan al menos 2)", () => {
    expect(() => tryStatFunction("stdev(5)")).toThrow();
  });

  it("devuelve null para expresiones que no son un llamado a función de estadística", () => {
    expect(tryStatFunction("2+2")).toBeNull();
    expect(tryStatFunction("sin(1)")).toBeNull();
  });
});
