// engine/matrixOps.ts — spec v10 §8/§9. Aritmética EXACTA con fraction.js
// (nunca floats) para que los resultados de sistemas y matrices se puedan
// expresar como fracción propia/impropia/mixta, según §11.
//
// Se centraliza aquí porque tanto el Modo Sistemas de ecuaciones (Módulo 5,
// resuelve por matriz aumentada) como el futuro Modo Matrices (Módulo 6)
// necesitan las mismas operaciones de fila — evita duplicar Gauss-Jordan.

import Fraction from "fraction.js";
import { ErrorCode, type AppError, type Step } from "../types";

export type Matrix = Fraction[][];

export type SystemSolutionKind = "unique" | "infinite" | "none";

export interface SystemSolution {
  kind: SystemSolutionKind;
  /** Solo con sentido si kind === "unique": valor de cada variable en el mismo orden que se pasó `variables`. */
  values?: Fraction[];
  steps: Step[];
}

function fmt(f: Fraction): string {
  return f.toFraction(true);
}

function matrixToLatex(m: Matrix): string {
  const rows = m.map((row) => row.map(fmt).join(" & ")).join(" \\\\ ");
  return `\\begin{bmatrix} ${rows} \\end{bmatrix}`;
}

function cloneMatrix(m: Matrix): Matrix {
  return m.map((row) => row.map((f) => new Fraction(f)));
}

/**
 * Gauss-Jordan sobre una matriz aumentada [A | b]. `variables` solo se usa
 * para las explicaciones de los pasos, no afecta el cálculo.
 */
export function gaussJordan(augmented: Matrix, variables: string[]): SystemSolution {
  const m = cloneMatrix(augmented);
  const rows = m.length;
  const cols = m[0].length; // incluye la columna aumentada
  const steps: Step[] = [
    { id: "initial", latex: matrixToLatex(m), explanation: "Matriz aumentada inicial [A | b]." },
  ];

  let pivotRow = 0;
  const pivotCols: number[] = [];

  for (let col = 0; col < cols - 1 && pivotRow < rows; col++) {
    // Buscar fila con entrada no nula en esta columna, desde pivotRow hacia abajo.
    let sel = -1;
    for (let r = pivotRow; r < rows; r++) {
      if (!m[r][col].equals(0)) {
        sel = r;
        break;
      }
    }
    if (sel === -1) continue; // columna sin pivote posible, variable libre

    if (sel !== pivotRow) {
      [m[sel], m[pivotRow]] = [m[pivotRow], m[sel]];
      steps.push({
        id: `swap-${pivotRow}-${sel}`,
        latex: matrixToLatex(m),
        explanation: `Se intercambia fila ${pivotRow + 1} con fila ${sel + 1} para obtener un pivote no nulo.`,
      });
    }

    const pivotValue = m[pivotRow][col];
    if (!pivotValue.equals(1)) {
      m[pivotRow] = m[pivotRow].map((v) => v.div(pivotValue));
      steps.push({
        id: `normalize-${pivotRow}`,
        latex: matrixToLatex(m),
        explanation: `Se divide la fila ${pivotRow + 1} entre ${fmt(pivotValue)} para que el pivote sea 1.`,
      });
    }

    for (let r = 0; r < rows; r++) {
      if (r === pivotRow) continue;
      const factor = m[r][col];
      if (factor.equals(0)) continue;
      m[r] = m[r].map((v, c) => v.sub(factor.mul(m[pivotRow][c])));
      steps.push({
        id: `eliminate-${r}-${pivotRow}`,
        latex: matrixToLatex(m),
        explanation: `Se elimina la columna de "${variables[col] ?? `var${col}`}" en la fila ${r + 1} usando la fila ${pivotRow + 1}.`,
      });
    }

    pivotCols.push(col);
    pivotRow++;
  }

  const rank = pivotRow;

  // Inconsistencia: fila [0 0 ... 0 | c] con c != 0.
  for (let r = rank; r < rows; r++) {
    const allZeroCoeffs = m[r].slice(0, cols - 1).every((v) => v.equals(0));
    if (allZeroCoeffs && !m[r][cols - 1].equals(0)) {
      steps.push({
        id: "inconsistent",
        latex: matrixToLatex(m),
        explanation: `La fila ${r + 1} equivale a "0 = ${fmt(m[r][cols - 1])}", una contradicción: el sistema no tiene solución.`,
      });
      return { kind: "none", steps };
    }
  }

  const numVariables = cols - 1;
  if (rank < numVariables) {
    steps.push({
      id: "infinite",
      latex: matrixToLatex(m),
      explanation: `El rango (${rank}) es menor que el número de variables (${numVariables}): el sistema es compatible indeterminado (infinitas soluciones).`,
    });
    return { kind: "infinite", steps };
  }

  const values = pivotCols.map((_col, r) => m[r][cols - 1]);
  steps.push({
    id: "unique",
    latex: variables.map((v, i) => `${v} = ${fmt(values[i])}`).join(",\\quad "),
    explanation: "Solución única leída directamente de la forma reducida.",
  });
  return { kind: "unique", values, steps };
}

export function toFractionMatrix(values: (string | number)[][]): Matrix {
  return values.map((row) =>
    row.map((v) => {
      // Celda vacía se trata como 0 (bug detectado en revisión: antes una
      // celda en blanco —muy común al dejar los ceros de una matriz dispersa
      // sin escribir— hacía fallar todo el cálculo con PARSE_ERROR).
      const normalized = typeof v === "string" && v.trim() === "" ? 0 : v;
      try {
        return new Fraction(normalized);
      } catch {
        throw {
          code: ErrorCode.PARSE_ERROR,
          message: `Valor no numérico en la matriz: "${v}".`,
        } as AppError;
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// Operaciones de matrices (Módulo 6, spec v10 §9). Reutilizan el mismo tipo
// Matrix (Fraction[][]) y el mismo helper matrixToLatex definido arriba.
// ---------------------------------------------------------------------------

function dims(m: Matrix): { rows: number; cols: number } {
  return { rows: m.length, cols: m[0]?.length ?? 0 };
}

function dimensionError(expected: string, got: string): AppError {
  return { code: ErrorCode.DIMENSION_MISMATCH, message: `Dimensiones incompatibles: se esperaba ${expected}, se recibió ${got}.` };
}

export function addMatrices(a: Matrix, b: Matrix): { result: Matrix; steps: Step[] } {
  const da = dims(a);
  const db = dims(b);
  if (da.rows !== db.rows || da.cols !== db.cols) {
    throw dimensionError(`misma dimensión que A (${da.rows}x${da.cols})`, `B de ${db.rows}x${db.cols}`);
  }
  const result = a.map((row, r) => row.map((v, c) => v.add(b[r][c])));
  return { result, steps: [{ id: "sum", latex: matrixToLatex(result), explanation: "Suma elemento a elemento." }] };
}

export function subtractMatrices(a: Matrix, b: Matrix): { result: Matrix; steps: Step[] } {
  const da = dims(a);
  const db = dims(b);
  if (da.rows !== db.rows || da.cols !== db.cols) {
    throw dimensionError(`misma dimensión que A (${da.rows}x${da.cols})`, `B de ${db.rows}x${db.cols}`);
  }
  const result = a.map((row, r) => row.map((v, c) => v.sub(b[r][c])));
  return { result, steps: [{ id: "diff", latex: matrixToLatex(result), explanation: "Resta elemento a elemento." }] };
}

export function multiplyMatrices(a: Matrix, b: Matrix): { result: Matrix; steps: Step[] } {
  const da = dims(a);
  const db = dims(b);
  if (da.cols !== db.rows) {
    throw dimensionError(`A de RxC y B de CxM (columnas de A = filas de B)`, `A de ${da.rows}x${da.cols} y B de ${db.rows}x${db.cols}`);
  }
  const result: Matrix = [];
  for (let r = 0; r < da.rows; r++) {
    const row: Fraction[] = [];
    for (let c = 0; c < db.cols; c++) {
      let sum = new Fraction(0);
      for (let k = 0; k < da.cols; k++) sum = sum.add(a[r][k].mul(b[k][c]));
      row.push(sum);
    }
    result.push(row);
  }
  return { result, steps: [{ id: "product", latex: matrixToLatex(result), explanation: "Producto matricial A·B." }] };
}

export function transposeMatrix(a: Matrix): { result: Matrix; steps: Step[] } {
  const { cols } = dims(a);
  const result: Matrix = [];
  for (let c = 0; c < cols; c++) {
    result.push(a.map((row) => row[c]));
  }
  return { result, steps: [{ id: "transpose", latex: matrixToLatex(result), explanation: "Filas y columnas intercambiadas." }] };
}

/** Determinante por expansión de cofactores — aceptable hasta 4x4 (spec v10 §9). */
export function determinant(a: Matrix): { value: Fraction; steps: Step[] } {
  const { rows, cols } = dims(a);
  if (rows !== cols) {
    throw { code: ErrorCode.DIMENSION_MISMATCH, message: "El determinante solo está definido para matrices cuadradas." } as AppError;
  }

  function minor(m: Matrix, skipRow: number, skipCol: number): Matrix {
    return m
      .filter((_, r) => r !== skipRow)
      .map((row) => row.filter((_, c) => c !== skipCol));
  }

  function det(m: Matrix): Fraction {
    const n = m.length;
    if (n === 1) return m[0][0];
    if (n === 2) return m[0][0].mul(m[1][1]).sub(m[0][1].mul(m[1][0]));
    let sum = new Fraction(0);
    for (let c = 0; c < n; c++) {
      const cofactorSign = c % 2 === 0 ? 1 : -1;
      sum = sum.add(m[0][c].mul(cofactorSign).mul(det(minor(m, 0, c))));
    }
    return sum;
  }

  const value = det(a);
  return {
    value,
    steps: [
      { id: "determinant", latex: `\\det(A) = ${value.toFraction(true)}`, explanation: "Calculado por expansión de cofactores." },
    ],
  };
}

/** Inversa por Gauss-Jordan sobre [A | I]. */
export function invertMatrix(a: Matrix): { result: Matrix; steps: Step[] } {
  const { rows, cols } = dims(a);
  if (rows !== cols) {
    throw { code: ErrorCode.DIMENSION_MISMATCH, message: "Solo las matrices cuadradas tienen inversa." } as AppError;
  }

  const { value: det } = determinant(a);
  if (det.equals(0)) {
    throw { code: ErrorCode.DOMAIN_ERROR, message: "La matriz es singular (determinante 0): no tiene inversa." } as AppError;
  }

  const augmented: Matrix = a.map((row, r) => [
    ...row.map((v) => new Fraction(v)),
    ...Array.from({ length: rows }, (_, c) => new Fraction(r === c ? 1 : 0)),
  ]);

  const m = cloneMatrix(augmented);
  const steps: Step[] = [{ id: "initial", latex: matrixToLatex(m), explanation: "Matriz aumentada [A | I]." }];

  for (let col = 0; col < rows; col++) {
    let sel = -1;
    for (let r = col; r < rows; r++) {
      if (!m[r][col].equals(0)) {
        sel = r;
        break;
      }
    }
    if (sel === -1) {
      throw { code: ErrorCode.DOMAIN_ERROR, message: "La matriz es singular: no tiene inversa." } as AppError;
    }
    if (sel !== col) [m[sel], m[col]] = [m[col], m[sel]];

    const pivot = m[col][col];
    m[col] = m[col].map((v) => v.div(pivot));

    for (let r = 0; r < rows; r++) {
      if (r === col) continue;
      const factor = m[r][col];
      if (factor.equals(0)) continue;
      m[r] = m[r].map((v, c) => v.sub(factor.mul(m[col][c])));
    }
  }
  steps.push({ id: "reduced", latex: matrixToLatex(m), explanation: "Forma [I | A⁻¹] tras Gauss-Jordan completo." });

  const result = m.map((row) => row.slice(rows));
  return { result, steps };
}

/** Potencia entera no negativa (spec v10 §9 — AMBIGUO: exponente negativo no soportado aún). */
export function powerMatrix(a: Matrix, n: number): { result: Matrix; steps: Step[] } {
  const { rows, cols } = dims(a);
  if (rows !== cols) {
    throw { code: ErrorCode.DIMENSION_MISMATCH, message: "La potencia de matrices solo está definida para matrices cuadradas." } as AppError;
  }
  if (!Number.isInteger(n) || n < 0) {
    throw { code: ErrorCode.UNSUPPORTED_OPERATION, message: "Solo se soportan exponentes enteros no negativos (A⁻¹ está disponible como inversa por separado)." } as AppError;
  }
  let result: Matrix = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: rows }, (_, c) => new Fraction(r === c ? 1 : 0)),
  );
  for (let i = 0; i < n; i++) {
    result = multiplyMatrices(result, a).result;
  }
  return { result, steps: [{ id: "power", latex: `A^{${n}} = ${matrixToLatex(result)}`, explanation: `Multiplicación repetida de A por sí misma ${n} veces.` }] };
}

// ---------------------------------------------------------------------------
// Fase C (spec UX estilo ClassCalc §4): ref/rref/producto de Kronecker.
// ref/rref reutilizan la misma mecánica de eliminación de gaussJordan (por
// eso vive todo en este archivo — evita una tercera copia de Gauss-Jordan).
// ---------------------------------------------------------------------------

/** Forma escalonada (ref): pivotes no necesariamente 1, sin reducción hacia arriba de cada pivote. */
export function ref(a: Matrix): { result: Matrix; steps: Step[] } {
  const m = cloneMatrix(a);
  const rows = m.length;
  const cols = dims(a).cols;
  const steps: Step[] = [{ id: "initial", latex: matrixToLatex(m), explanation: "Matriz original." }];
  let pivotRow = 0;
  for (let col = 0; col < cols && pivotRow < rows; col++) {
    let sel = -1;
    for (let r = pivotRow; r < rows; r++) {
      if (!m[r][col].equals(0)) {
        sel = r;
        break;
      }
    }
    if (sel === -1) continue;
    if (sel !== pivotRow) {
      [m[sel], m[pivotRow]] = [m[pivotRow], m[sel]];
      steps.push({ id: `swap-${pivotRow}`, latex: matrixToLatex(m), explanation: `Se intercambia fila ${pivotRow + 1} con fila ${sel + 1}.` });
    }
    for (let r = pivotRow + 1; r < rows; r++) {
      const factor = m[r][col].div(m[pivotRow][col]);
      if (factor.equals(0)) continue;
      m[r] = m[r].map((v, c) => v.sub(factor.mul(m[pivotRow][c])));
      steps.push({
        id: `eliminate-${r}-${pivotRow}`,
        latex: matrixToLatex(m),
        explanation: `Se elimina la columna ${col + 1} en la fila ${r + 1} usando la fila ${pivotRow + 1}.`,
      });
    }
    pivotRow++;
  }
  steps.push({ id: "ref", latex: matrixToLatex(m), explanation: "Forma escalonada (ref)." });
  return { result: m, steps };
}

/** Forma escalonada reducida (rref): cada pivote es 1, sin entradas distintas de 0 arriba o abajo de él. */
export function rref(a: Matrix): { result: Matrix; steps: Step[] } {
  const m = cloneMatrix(a);
  const rows = m.length;
  const cols = dims(a).cols;
  const steps: Step[] = [{ id: "initial", latex: matrixToLatex(m), explanation: "Matriz original." }];
  let pivotRow = 0;
  for (let col = 0; col < cols && pivotRow < rows; col++) {
    let sel = -1;
    for (let r = pivotRow; r < rows; r++) {
      if (!m[r][col].equals(0)) {
        sel = r;
        break;
      }
    }
    if (sel === -1) continue;
    if (sel !== pivotRow) {
      [m[sel], m[pivotRow]] = [m[pivotRow], m[sel]];
      steps.push({ id: `swap-${pivotRow}`, latex: matrixToLatex(m), explanation: `Se intercambia fila ${pivotRow + 1} con fila ${sel + 1}.` });
    }
    const pivotValue = m[pivotRow][col];
    if (!pivotValue.equals(1)) {
      m[pivotRow] = m[pivotRow].map((v) => v.div(pivotValue));
      steps.push({ id: `normalize-${pivotRow}`, latex: matrixToLatex(m), explanation: `Se divide la fila ${pivotRow + 1} entre ${fmt(pivotValue)}.` });
    }
    for (let r = 0; r < rows; r++) {
      if (r === pivotRow) continue;
      const factor = m[r][col];
      if (factor.equals(0)) continue;
      m[r] = m[r].map((v, c) => v.sub(factor.mul(m[pivotRow][c])));
      steps.push({ id: `eliminate-${r}-${pivotRow}`, latex: matrixToLatex(m), explanation: `Se elimina la columna ${col + 1} en la fila ${r + 1}.` });
    }
    pivotRow++;
  }
  steps.push({ id: "rref", latex: matrixToLatex(m), explanation: "Forma escalonada reducida (rref)." });
  return { result: m, steps };
}

/** Producto de Kronecker A⊗B. */
export function kroneckerProduct(a: Matrix, b: Matrix): { result: Matrix; steps: Step[] } {
  const da = dims(a);
  const db = dims(b);
  const result: Matrix = [];
  for (let i = 0; i < da.rows; i++) {
    for (let bi = 0; bi < db.rows; bi++) {
      const row: Fraction[] = [];
      for (let j = 0; j < da.cols; j++) {
        for (let bj = 0; bj < db.cols; bj++) {
          row.push(a[i][j].mul(b[bi][bj]));
        }
      }
      result.push(row);
    }
  }
  return { result, steps: [{ id: "kron", latex: matrixToLatex(result), explanation: "Producto de Kronecker A⊗B." }] };
}

// ---------------------------------------------------------------------------
// P5 (spec v2 §6): Vectores en Matrices — dot/cross/norm. Un vector es una
// matriz 1xn o nx1 — no se crea componente de entrada nuevo (spec
// explícita), se reutiliza MatrixGridInput configurado con 1 fila o 1
// columna.
//
// `norm` rompe deliberadamente la regla "aritmética EXACTA con
// fraction.js (nunca floats)" del encabezado de este archivo: una raíz
// cuadrada normalmente NO es racional (ej. norm([1,1]) = sqrt(2)). La
// suma de cuadrados se calcula exacta en Fraction; solo el paso final
// (la raíz) se aproxima a decimal, y únicamente cuando no es un cuadrado
// perfecto. Documentado aquí explícitamente para que quede claro que es
// una excepción deliberada, no un descuido.
// ---------------------------------------------------------------------------

function toVector(m: Matrix): Fraction[] {
  const { rows, cols } = dims(m);
  if (rows === 1) return m[0];
  if (cols === 1) return m.map((row) => row[0]);
  throw {
    code: ErrorCode.DIMENSION_MISMATCH,
    message: `Se esperaba un vector (1 fila o 1 columna), se recibió una matriz de ${rows}x${cols}.`,
  } as AppError;
}

export function dotProduct(a: Matrix, b: Matrix): { value: Fraction; steps: Step[] } {
  const va = toVector(a);
  const vb = toVector(b);
  if (va.length !== vb.length) {
    throw dimensionError(`vector de la misma longitud que A (${va.length})`, `vector de longitud ${vb.length}`);
  }
  let sum = new Fraction(0);
  for (let i = 0; i < va.length; i++) sum = sum.add(va[i].mul(vb[i]));
  return {
    value: sum,
    steps: [{ id: "dot", latex: `A \\cdot B = ${sum.toFraction(true)}`, explanation: "Suma de los productos componente a componente." }],
  };
}

/** Válido únicamente para vectores de 3 componentes (spec v2 §6) —
 * dimensión inválida reutiliza el mismo AppError/ErrorCode.DIMENSION_MISMATCH
 * que el resto de las operaciones de matrices, no un código nuevo. */
export function crossProduct(a: Matrix, b: Matrix): { result: Matrix; steps: Step[] } {
  const va = toVector(a);
  const vb = toVector(b);
  if (va.length !== 3 || vb.length !== 3) {
    throw dimensionError("vectores de 3 componentes", `A de ${va.length} y B de ${vb.length}`);
  }
  const [a1, a2, a3] = va;
  const [b1, b2, b3] = vb;
  const result: Matrix = [[a2.mul(b3).sub(a3.mul(b2)), a3.mul(b1).sub(a1.mul(b3)), a1.mul(b2).sub(a2.mul(b1))]];
  return {
    result,
    steps: [{ id: "cross", latex: matrixToLatex(result), explanation: "Producto cruz A×B (solo definido en 3 dimensiones)." }],
  };
}

/** Magnitud/norma euclidiana. No requiere matriz B (como transpose/
 * determinant/inverse) — ver comentario de sección arriba sobre por qué
 * no es aritmética 100% exacta. */
export function vectorNorm(a: Matrix): { resultLatex: string; steps: Step[] } {
  const v = toVector(a);
  let sumSquares = new Fraction(0);
  for (const x of v) sumSquares = sumSquares.add(x.mul(x));

  const decimalSumSquares = sumSquares.valueOf();
  const sqrtValue = Math.sqrt(decimalSumSquares);
  const roundedSqrt = Math.round(sqrtValue);
  const isPerfectSquare = Number.isInteger(decimalSumSquares) && roundedSqrt * roundedSqrt === decimalSumSquares;

  const resultLatex = isPerfectSquare
    ? String(roundedSqrt)
    : `\\sqrt{${sumSquares.toFraction(true)}} \\approx ${Number(sqrtValue.toPrecision(12))}`;

  return {
    resultLatex,
    steps: [
      {
        id: "sumsq",
        latex: `\\|v\\|^2 = ${sumSquares.toFraction(true)}`,
        explanation: "Suma de los cuadrados de cada componente (exacta).",
      },
      {
        id: "norm",
        latex: `\\|v\\| = ${resultLatex}`,
        explanation: isPerfectSquare
          ? "Raíz cuadrada exacta (cuadrado perfecto)."
          : "Raíz cuadrada aproximada a 12 cifras (no es un cuadrado perfecto — ver nota de la sección sobre aritmética no exacta).",
      },
    ],
  };
}
