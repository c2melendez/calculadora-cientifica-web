import { describe, it, expect } from "vitest";
import { parseExpression } from "../src/engine/parsing";
import { ErrorCode } from "../src/types";

// Casos obligatorios de la spec (v9 §15, heredados en v10). NO EJECUTADO en
// el entorno de generación (sin acceso a npm/vitest) — correr con
// `npm run test` tras `npm install`.

describe("parseExpression", () => {
  it("normaliza √4+1 a sqrt(4)+1, nunca sqrt(5)", () => {
    expect(parseExpression("√4+1").algebrite).toBe("sqrt(4)+1");
  });

  it("rechaza .5 (punto decimal sin dígito inicial)", () => {
    expect(() => parseExpression(".5")).toThrowError(
      expect.objectContaining({ code: ErrorCode.PARSE_ERROR }),
    );
  });

  it("rechaza 5. (punto decimal sin dígito final)", () => {
    expect(() => parseExpression("5.")).toThrowError(
      expect.objectContaining({ code: ErrorCode.PARSE_ERROR }),
    );
  });

  it("rechaza notación científica 1e5", () => {
    expect(() => parseExpression("1e5")).toThrowError(
      expect.objectContaining({ code: ErrorCode.PARSE_ERROR }),
    );
  });

  it('no divide "theta" en t*h*e*t*a', () => {
    expect(parseExpression("theta").algebrite).toBe("theta");
  });

  it('"2theta" se vuelve "2*theta"', () => {
    expect(parseExpression("2theta").algebrite).toBe("2*theta");
  });

  it('"theta*x" queda sin cambios (ya tiene * explícito)', () => {
    const result = parseExpression("theta*x").algebrite;
    expect(result).toBe("theta*x");
  });

  it('"xyz" sin separadores es un único identificador de 3 letras', () => {
    expect(parseExpression("xyz").algebrite).toBe("xyz");
  });

  it("log(x) es válido (aridad 1)", () => {
    expect(() => parseExpression("log(x)")).not.toThrow();
  });

  it("log(x,2) es válido (aridad 2, base b)", () => {
    expect(() => parseExpression("log(x,2)")).not.toThrow();
  });

  it("log(x,2,3) es inválido (aridad 3)", () => {
    expect(() => parseExpression("log(x,2,3)")).toThrowError(
      expect.objectContaining({ code: ErrorCode.PARSE_ERROR }),
    );
  });

  it("más de un = es PARSE_ERROR", () => {
    expect(() => parseExpression("x=2=3")).toThrowError(
      expect.objectContaining({ code: ErrorCode.PARSE_ERROR }),
    );
  });

  it("sin = se asume = 0 (isEquation: false)", () => {
    expect(parseExpression("x+1").isEquation).toBe(false);
  });

  it("con = se marca isEquation: true", () => {
    expect(parseExpression("x+1=2").isEquation).toBe(true);
  });

  it("\\frac{3}{4} se convierte a división explícita", () => {
    expect(parseExpression("\\frac{3}{4}").algebrite).toBe("((3)/(4))");
  });

  it("\\sqrt[3]{8} es raíz cúbica, NO raíz cuadrada (bug detectado en revisión: el índice se perdía en silencio)", () => {
    expect(parseExpression("\\sqrt[3]{8}").algebrite).toBe("(8)^(1/(3))");
  });

  it("\\sqrt{9} (sin índice) sigue funcionando como raíz cuadrada normal", () => {
    expect(parseExpression("\\sqrt{9}").algebrite).toBe("sqrt(9)");
  });

  it("GRAD convierte argumento de sin directo a radianes (*pi/180)", () => {
    expect(parseExpression("sin(30)", "GRAD").algebrite).toBe("sin((30)*pi/180)");
  });

  it("RAD no modifica el argumento de sin", () => {
    expect(parseExpression("sin(30)", "RAD").algebrite).toBe("sin(30)");
  });

  it("rechaza paréntesis vacíos en una función, ej. sqrt() (bug detectado en revisión: antes se contaba como 1 argumento)", () => {
    expect(() => parseExpression("sqrt()")).toThrowError(
      expect.objectContaining({ code: ErrorCode.PARSE_ERROR }),
    );
  });

  // Fase 3 de la hoja de ruta ("motor científico completo") — verificado
  // contra el paquete algebrite real antes de escribir estos casos, no
  // asumido (ver postfixOperators.ts para el porqué del orden del pipeline).
  describe("Fase 3 — motor científico completo", () => {
    it('"5!" se expande a factorial(5), no se pasa el "!" literal', () => {
      expect(parseExpression("5!").algebrite).toBe("factorial(5)");
    });

    it('"5!x" inserta la multiplicación implícita tras el factorial (bug real: antes "!" no contaba como fin de átomo)', () => {
      expect(parseExpression("5!x").algebrite).toBe("factorial(5)*x");
    });

    it('"3+2!" aplica "!" solo al 2, no a "3+2" completo', () => {
      expect(parseExpression("3+2!").algebrite).toBe("3+factorial(2)");
    });

    it('"sin(x)!" incluye la función completa como átomo del factorial', () => {
      expect(parseExpression("sin(x)!").algebrite).toBe("factorial(sin(x))");
    });

    it('"50%" se expande a (50)/100', () => {
      expect(parseExpression("50%").algebrite).toBe("(50)/100");
    });

    it('"50%x" inserta la multiplicación implícita tras el porcentaje', () => {
      expect(parseExpression("50%x").algebrite).toBe("(50)/100*x");
    });

    it("tau y phi se sustituyen por su valor exacto (Algebrite no los conoce nativamente)", () => {
      expect(parseExpression("tau").algebrite).toBe("(2*pi)");
      expect(parseExpression("phi").algebrite).toBe("((1+sqrt(5))/2)");
    });

    it("sinh/cosh/tanh/asinh/acosh/atanh/exp/sign son funciones válidas (aridad 1)", () => {
      for (const fn of ["sinh", "cosh", "tanh", "asinh", "acosh", "atanh", "exp", "sign"]) {
        expect(() => parseExpression(`${fn}(1)`)).not.toThrow();
      }
    });

    it("nPr(5,2) y nCr(5,2) se reescriben en términos de factorial (Algebrite no las conoce nativamente)", () => {
      expect(parseExpression("nPr(5,2)").algebrite).toBe(
        "(factorial(5)/factorial((5)-(2)))",
      );
      expect(parseExpression("nCr(5,2)").algebrite).toBe(
        "(factorial(5)/(factorial(2)*factorial((5)-(2))))",
      );
    });

    it("nPr/nCr con aridad distinta de 2 es PARSE_ERROR", () => {
      expect(() => parseExpression("nPr(5)")).toThrowError(
        expect.objectContaining({ code: ErrorCode.PARSE_ERROR }),
      );
    });
  });
});
