import { describe, it, expect } from "vitest";
import {
  toFractionMatrix,
  addMatrices,
  multiplyMatrices,
  transposeMatrix,
  determinant,
  invertMatrix,
  powerMatrix,
  ref,
  rref,
  kroneckerProduct,
} from "../src/engine/matrixOps";

// NO EJECUTADO en el entorno de generación. Correr con `npm run test`.

describe("matrixOps", () => {
  const A = toFractionMatrix([
    [1, 2],
    [3, 4],
  ]);
  const B = toFractionMatrix([
    [5, 6],
    [7, 8],
  ]);

  it("trata una celda vacía como 0 (bug detectado en revisión: antes fallaba con PARSE_ERROR)", () => {
    const M = toFractionMatrix([
      ["1", ""],
      ["", "1"],
    ]);
    expect(M.map((r) => r.map((v) => v.toFraction()))).toEqual([
      ["1", "0"],
      ["0", "1"],
    ]);
  });

  it("suma A+B elemento a elemento", () => {
    const { result } = addMatrices(A, B);
    expect(result.map((r) => r.map((v) => v.toFraction()))).toEqual([
      ["6", "8"],
      ["10", "12"],
    ]);
  });

  it("multiplica A*B correctamente", () => {
    const { result } = multiplyMatrices(A, B);
    // [1*5+2*7, 1*6+2*8; 3*5+4*7, 3*6+4*8] = [19,22; 43,50]
    expect(result.map((r) => r.map((v) => v.toFraction()))).toEqual([
      ["19", "22"],
      ["43", "50"],
    ]);
  });

  it("transpone A correctamente", () => {
    const { result } = transposeMatrix(A);
    expect(result.map((r) => r.map((v) => v.toFraction()))).toEqual([
      ["1", "3"],
      ["2", "4"],
    ]);
  });

  it("calcula el determinante de A (1*4-2*3=-2)", () => {
    const { value } = determinant(A);
    expect(value.toFraction()).toBe("-2");
  });

  it("calcula la inversa de A y al multiplicarla por A da la identidad", () => {
    const { result: inv } = invertMatrix(A);
    const { result: identity } = multiplyMatrices(A, inv);
    expect(identity.map((r) => r.map((v) => v.toFraction()))).toEqual([
      ["1", "0"],
      ["0", "1"],
    ]);
  });

  it("rechaza la inversa de una matriz singular", () => {
    const singular = toFractionMatrix([
      [1, 2],
      [2, 4],
    ]);
    expect(() => invertMatrix(singular)).toThrow();
  });

  it("calcula A^2 como A*A", () => {
    const { result: squared } = powerMatrix(A, 2);
    const { result: manual } = multiplyMatrices(A, A);
    expect(squared.map((r) => r.map((v) => v.toFraction()))).toEqual(
      manual.map((r) => r.map((v) => v.toFraction())),
    );
  });

  it("A^0 es la identidad", () => {
    const { result } = powerMatrix(A, 0);
    expect(result.map((r) => r.map((v) => v.toFraction()))).toEqual([
      ["1", "0"],
      ["0", "1"],
    ]);
  });

  // Fase C (spec UX estilo ClassCalc §4) — verificado contra un caso
  // manual conocido antes de escribir estos casos, no asumido.
  it("rref de una matriz singular deja la fila dependiente en ceros", () => {
    const singular = toFractionMatrix([
      ["1", "2"],
      ["2", "4"],
    ]);
    const { result } = rref(singular);
    expect(result[1].map((v) => v.toFraction())).toEqual(["0", "0"]);
  });

  it("ref de la identidad no la altera", () => {
    const identity = toFractionMatrix([
      ["1", "0"],
      ["0", "1"],
    ]);
    const { result } = ref(identity);
    expect(result.map((r) => r.map((v) => v.toFraction()))).toEqual([
      ["1", "0"],
      ["0", "1"],
    ]);
  });

  it("producto de Kronecker de 2x2 con 2x2 da 4x4 con las entradas correctas", () => {
    const a = toFractionMatrix([
      ["1", "2"],
      ["3", "4"],
    ]);
    const b = toFractionMatrix([
      ["0", "5"],
      ["6", "7"],
    ]);
    const { result } = kroneckerProduct(a, b);
    expect(result.length).toBe(4);
    expect(result[0].length).toBe(4);
    // result[i*2+bi][j*2+bj] = A[i][j] * B[bi][bj]
    expect(result[0][1].toFraction()).toBe("5"); // A[0][0]*B[0][1] = 1*5
    expect(result[2][1].toFraction()).toBe("15"); // A[1][0]*B[0][1] = 3*5
    expect(result[3][2].toFraction()).toBe("24"); // A[1][1]*B[1][0] = 4*6
  });
});
