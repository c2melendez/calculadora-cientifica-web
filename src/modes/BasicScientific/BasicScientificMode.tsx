import { useCallback, useRef, useState } from "react";
import { MathKeyboard } from "../../components/MathKeyboard";
import { Screen } from "../../components/Screen";
import { type SessionHistoryEntry } from "../../components/HistoryLog";
import { makeRequestId, ErrorCode, type MathResult } from "../../types";
import { parseExpression } from "../../engine/parsing";
import { splitSystemLatex } from "../../engine/parsing/systemSplit";
import { addHistoryEntry } from "../../store/historyDb";

// Modo 1 de la spec v10 §5. Orquesta NaturalInput + MathKeyboard +
// ResultPanel, delegando todo el cómputo al Web Worker (nunca al hilo
// principal — regla dura de §3/§12).
//
// Fase A (spec UX estilo ClassCalc): el teclado ahora inserta con
// field.insert() (cursor-aware, plantillas #0) en vez de concatenar texto
// al final — se guarda una referencia real al <math-field>. El popover
// DEG/RAD sale del teclado y vive en el header de este modo.
//
// Fase 1 (fusión de modos, plan de 3 fases): handleCalculate ahora es un
// router — antes SIEMPRE mandaba {type:"evaluate"} al worker sin mirar si
// la expresión era una ecuación (bug real: "2x+3=7" se "resolvía" como
// simplificar la resta 2x-4, nunca despejaba x=2). Ahora:
//   1. Si el campo tiene un entorno \begin{cases}, se trata como sistema
//      (mismo pipeline que LinearSystemsMode.tsx, con N campos).
//   2. Si no, se parsea una vez con parseExpression(); si es ecuación
//      (parsed.isEquation) con exactamente 1 variable libre, se resuelve
//      con solveAlgebra (mismo pipeline que AlgebraMode.tsx).
//   3. Si no es ecuación, se evalúa como antes.
// AlgebraMode.tsx y LinearSystemsMode.tsx no se eliminaron — siguen
// existiendo como pestañas aparte para quien prefiera esa UI dedicada
// (ej. sistemas con más de 4 ecuaciones, o elegir la variable a despejar
// cuando hay más de una). Este router es el atajo dentro de la pantalla
// unificada para el caso común.

type MathFieldRef = { insert: (s: string) => void; focus: () => void; value: string } | null;

export function BasicScientificMode() {
  const [latex, setLatex] = useState("");
  const [result, setResult] = useState<MathResult | null>(null);
  const [angleMode, setAngleMode] = useState<"RAD" | "GRAD">("RAD");
  const workerRef = useRef<Worker | null>(null);
  const [mathField, setMathField] = useState<MathFieldRef>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryEntry[]>([]);

  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../../workers/compute.worker.ts", import.meta.url),
        { type: "module" },
      );
    }
    return workerRef.current;
  }, []);

  const fail = useCallback((code: ErrorCode, message: string, requestId: string) => {
    setResult({
      success: false,
      errorCode: code,
      errorMessage: message,
      resultLatex: null,
      steps: [],
      hasDetailedSteps: false,
      confidence: "SYMBOLIC",
      requestId,
    });
  }, []);

  const onSuccess = useCallback((mode: string, inputDisplay: string, data: MathResult) => {
    setResult(data);
    if (data.success) {
      addHistoryEntry({ mode, input: inputDisplay, resultSummary: data.resultLatex ?? "" });
      setSessionHistory((prev) => [...prev, { id: data.requestId, input: inputDisplay, result: data }]);
    }
  }, []);

  // Rama 1: sistema (entorno \begin{cases} detectado). Mismo pipeline que
  // LinearSystemsMode.tsx, ver comentario ahí para el detalle de por qué
  // se exige #variables === #ecuaciones.
  const runSystem = useCallback(
    (rows: string[]) => {
      const requestId = makeRequestId();
      const allVariables = new Set<string>();
      const equationsAlgebrite: string[] = [];

      for (const eq of rows) {
        let parsed;
        try {
          parsed = parseExpression(eq, angleMode);
        } catch (err) {
          const appErr = err as { code?: ErrorCode; message?: string };
          fail(appErr.code ?? ErrorCode.PARSE_ERROR, appErr.message ?? "Ecuación inválida.", requestId);
          return;
        }
        if (!parsed.isEquation) {
          fail(ErrorCode.PARSE_ERROR, `Cada renglón del sistema debe ser una ecuación con "=": "${eq}".`, requestId);
          return;
        }
        parsed.freeVariables.forEach((v) => allVariables.add(v));
        equationsAlgebrite.push(parsed.algebrite);
      }

      const variables = [...allVariables].sort();
      if (variables.length !== rows.length) {
        fail(
          ErrorCode.PARSE_ERROR,
          `Se detectaron ${variables.length} variable(s) distintas (${variables.join(", ") || "ninguna"}) pero hay ${rows.length} ecuaciones. Para una solución determinada, el número de variables debe igualar al de ecuaciones.`,
          requestId,
        );
        return;
      }

      const worker = getWorker();
      worker.onmessage = (e: MessageEvent<MathResult>) =>
        onSuccess("Científica (sistema)", rows.join("; "), e.data);
      worker.postMessage({ type: "linearSystem", requestId, equationsAlgebrite, variables });
    },
    [angleMode, getWorker, fail, onSuccess],
  );

  const handleCalculate = useCallback(() => {
    const systemRows = splitSystemLatex(latex);
    if (systemRows) {
      runSystem(systemRows);
      return;
    }

    const requestId = makeRequestId();
    let parsed;
    try {
      parsed = parseExpression(latex, angleMode);
    } catch (err) {
      const appErr = err as { code?: ErrorCode; message?: string };
      fail(appErr.code ?? ErrorCode.PARSE_ERROR, appErr.message ?? "Expresión inválida.", requestId);
      return;
    }

    const worker = getWorker();

    // Rama 2: ecuación de una variable (spec §6 — igual criterio que
    // AlgebraMode.tsx: 0 o >1 variables libres se rechaza en vez de
    // adivinar cuál despejar).
    if (parsed.isEquation) {
      if (parsed.freeVariables.length !== 1) {
        fail(
          ErrorCode.PARSE_ERROR,
          parsed.freeVariables.length === 0
            ? "No se detectó ninguna variable para despejar."
            : `Hay más de una variable (${parsed.freeVariables.join(", ")}); usa la pestaña Álgebra para elegir cuál despejar.`,
          requestId,
        );
        return;
      }
      worker.onmessage = (e: MessageEvent<MathResult>) => onSuccess("Científica (ecuación)", latex, e.data);
      worker.postMessage({
        type: "solveAlgebra",
        requestId,
        leftAlgebrite: parsed.leftAlgebrite,
        rightAlgebrite: parsed.rightAlgebrite,
        variable: parsed.freeVariables[0],
      });
      return;
    }

    // Rama 3: expresión simple (comportamiento original, sin cambios).
    worker.onmessage = (e: MessageEvent<MathResult>) => onSuccess("Científica", latex, e.data);
    worker.postMessage({ type: "evaluate", requestId, expressionAlgebrite: parsed.algebrite });
  }, [latex, angleMode, getWorker, fail, onSuccess, runSystem]);

  // Íconos de resolución (spec §3.4). "f(x)=0": si aún no hay "=" en el
  // campo, lo inserta (mismo comportamiento previo); si ya hay una
  // ecuación, ahora SÍ la resuelve de verdad (antes caía silenciosamente
  // en evaluate — ver comentario de handleCalculate arriba).
  const handleSolveEquation = useCallback(() => {
    if (!latex.includes("=")) {
      mathField?.insert("=0");
      return;
    }
    handleCalculate();
  }, [latex, handleCalculate, mathField]);

  // Fase 1: antes este ícono no hacía nada (onSolveSystem nunca se pasaba
  // a MathKeyboard). Ahora, si el campo todavía no tiene un sistema,
  // inserta la plantilla \begin{cases}; si ya la tiene con 2+ renglones,
  // resuelve — mismo patrón que handleSolveEquation con "=0".
  const handleSolveSystem = useCallback(() => {
    if (!splitSystemLatex(latex)) {
      mathField?.insert("\\begin{cases}#0\\\\#1\\end{cases}");
      return;
    }
    handleCalculate();
  }, [latex, handleCalculate, mathField]);

  const handleSimplify = useCallback(() => handleCalculate(), [handleCalculate]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-4">
      <Screen
        latex={latex}
        onChangeLatex={setLatex}
        placeholder="Escribe una expresión, ecuación o sistema…"
        fieldRef={setMathField}
        result={result}
        sessionHistory={sessionHistory}
        angleMode={angleMode}
        onToggleAngleMode={() => setAngleMode((m) => (m === "RAD" ? "GRAD" : "RAD"))}
        onClearField={() => setLatex("")}
      />
      <MathKeyboard
        field={mathField}
        onBackspace={() => setLatex((prev) => prev.slice(0, -1))}
        onEnter={handleCalculate}
        onClearField={() => setLatex("")}
        onSolveEquation={handleSolveEquation}
        onSolveSystem={handleSolveSystem}
        onSimplify={handleSimplify}
      />
    </div>
  );
}
