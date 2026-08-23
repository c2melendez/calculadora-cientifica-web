// stepEngine/algebra.ts (spec v10 Módulo 3, Modo 2 — Álgebra).
//
// HONESTIDAD DE ALCANCE: generar pasos de aislamiento de variable
// verdaderamente genéricos (mover términos, dividir por coeficiente, etc.)
// para cualquier ecuación algebraica es un problema abierto no trivial sin
// SymPy. Esta primera versión usa Algebrite para obtener la forma estándar
// y las raíces, y expone 3 pasos "de alto nivel" (no aislamiento término a
// término). `hasDetailedSteps: false` refleja esto honestamente — ver
// spec v10 §4 (`MathResult.hasDetailedSteps`). Mejorar esto a pasos
// término-a-término queda como TODO explícito para un módulo posterior.

import { evaluate, solveEquation, ErrorCode } from "../algebriteClient";
import type { Step, AppError } from "../../types";

export interface AlgebraSolveResult {
  steps: Step[];
  solutionsAlgebrite: string[];
}

export function solveAlgebra(
  leftAlgebrite: string,
  rightAlgebrite: string,
  variable: string,
): AlgebraSolveResult {
  const steps: Step[] = [];

  steps.push({
    id: "original",
    latex: `${leftAlgebrite} = ${rightAlgebrite}`,
    explanation: "Ecuación original.",
  });

  let standardForm: string;
  try {
    standardForm = evaluate(`simplify(${leftAlgebrite}-(${rightAlgebrite}))`);
  } catch (err) {
    throw err as AppError;
  }
  steps.push({
    id: "standard-form",
    latex: `${standardForm} = 0`,
    explanation: "Se agrupan todos los términos en un solo lado (forma estándar).",
  });

  let solutions: string[];
  try {
    solutions = solveEquation(standardForm, variable);
  } catch {
    throw { code: ErrorCode.UNSUPPORTED_OPERATION, message: `No se encontró una solución algebraica para "${variable}".` } as AppError;
  }

  if (solutions.length === 0) {
    throw { code: ErrorCode.UNSUPPORTED_OPERATION, message: "La ecuación no tiene solución, o Algebrite no pudo resolverla." } as AppError;
  }

  steps.push({
    id: "solutions",
    latex: solutions.map((s) => `${variable} = ${s}`).join(",\\quad "),
    explanation: solutions.length > 1 ? "Raíces obtenidas simbólicamente." : "Raíz obtenida simbólicamente.",
  });

  return { steps, solutionsAlgebrite: solutions };
}
