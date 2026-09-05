// modes/Statistics/StatisticsMode.tsx — P6 (spec v2 §7): Descriptiva /
// Combinatoria / Distribución. Los cálculos son JS puro y síncronos (no
// pasan por el worker: son funciones de statFunctions.ts/distributions.ts
// operando sobre arreglos numéricos ya parseados, no expresiones
// simbólicas que necesiten Algebrite) — se arma un `MathResult` a mano
// para reutilizar ResultPanel.tsx sin tocarlo.

import { useMemo, useState } from "react";
import { DataListInput, parseDataList } from "../../components/DataListInput";
import { ResultPanel } from "../../components/ResultPanel";
import {
  mean,
  median,
  modes,
  range as dataRange,
  stdev,
  stdevPopulation,
  variance,
  variancePopulation,
} from "../../engine/statFunctions";
import {
  binomialPMF,
  binomialCDF,
  binomialSurvival,
  binomialMean,
  binomialVariance,
  normalCDF,
  normalRange,
  zScore,
} from "../../engine/distributions";
import { makeRequestId, ErrorCode, type MathResult } from "../../types";
import { addHistoryEntry } from "../../store/historyDb";

type SubMode = "descriptive" | "combinatorics" | "distribution";
type VarianceKind = "population" | "sample";
type Distribution = "binomial" | "normal";
type BinomialQuery = "pmf" | "cdf" | "survival" | "mean" | "variance";
type NormalQuery = "cdf" | "range" | "zscore";

function okResult(resultLatex: string): MathResult {
  return {
    success: true,
    resultLatex,
    steps: [],
    hasDetailedSteps: false,
    confidence: "NUMERIC_FALLBACK",
    requestId: makeRequestId(),
  };
}

function errResult(message: string): MathResult {
  return {
    success: false,
    errorCode: ErrorCode.DOMAIN_ERROR,
    errorMessage: message,
    resultLatex: null,
    steps: [],
    hasDetailedSteps: false,
    confidence: "NUMERIC_FALLBACK",
    requestId: makeRequestId(),
  };
}

function fmt(n: number): string {
  return Number(n.toPrecision(10)).toString();
}

const TABS: { id: SubMode; label: string }[] = [
  { id: "descriptive", label: "Descriptiva" },
  { id: "combinatorics", label: "Combinatoria" },
  { id: "distribution", label: "Distribución" },
];

export function StatisticsMode() {
  const [subMode, setSubMode] = useState<SubMode>("descriptive");

  // --- Descriptiva ---
  const [dataChips, setDataChips] = useState<string[]>([]);
  const [varianceKind, setVarianceKind] = useState<VarianceKind>("population");
  const [descriptiveResult, setDescriptiveResult] = useState<MathResult | null>(null);

  const descriptiveValues = useMemo(() => {
    try {
      return parseDataList(dataChips);
    } catch {
      return null;
    }
  }, [dataChips]);

  function runDescriptive(fn: string) {
    if (!descriptiveValues || descriptiveValues.length === 0) {
      setDescriptiveResult(errResult("Agrega al menos un valor a la lista."));
      return;
    }
    try {
      const v = descriptiveValues;
      let out: number;
      switch (fn) {
        case "mean":
          out = mean(v);
          break;
        case "median":
          out = median(v);
          break;
        case "mode": {
          const m = modes(v);
          setDescriptiveResult(okResult(m.length === 1 ? fmt(m[0]) : `[${m.map(fmt).join(", ")}]`));
          return;
        }
        case "sum":
          out = v.reduce((a, b) => a + b, 0);
          break;
        case "sumsq":
          out = v.reduce((a, b) => a + b * b, 0);
          break;
        case "n":
          out = v.length;
          break;
        case "min":
          out = Math.min(...v);
          break;
        case "max":
          out = Math.max(...v);
          break;
        case "range":
          out = dataRange(v);
          break;
        case "variance":
          out = varianceKind === "population" ? variancePopulation(v) : variance(v);
          break;
        case "stdev":
          out = varianceKind === "population" ? stdevPopulation(v) : stdev(v);
          break;
        default:
          return;
      }
      const result = okResult(fmt(out));
      setDescriptiveResult(result);
      addHistoryEntry({ mode: "Estadística (Descriptiva)", input: dataChips.join(", "), resultSummary: result.resultLatex ?? "" });
    } catch (e) {
      setDescriptiveResult(errResult(e instanceof Error ? e.message : "Error desconocido."));
    }
  }

  // --- Combinatoria ---
  const [nStr, setNStr] = useState("8");
  const [rStr, setRStr] = useState("3");
  const [combinatoricsResult, setCombinatoricsResult] = useState<MathResult | null>(null);

  function runCombinatorics(fn: "nCr" | "nPr" | "factorial") {
    const n = Number(nStr);
    const r = Number(rStr);
    if (!Number.isInteger(n) || n < 0) {
      setCombinatoricsResult(errResult("n debe ser un entero no negativo."));
      return;
    }
    if (fn !== "factorial" && (!Number.isInteger(r) || r < 0)) {
      setCombinatoricsResult(errResult("r debe ser un entero no negativo."));
      return;
    }
    try {
      function fact(x: number): number {
        let acc = 1;
        for (let i = 2; i <= x; i++) acc *= i;
        return acc;
      }
      let out: number;
      let label: string;
      if (fn === "factorial") {
        out = fact(n);
        label = `${n}!`;
      } else if (fn === "nCr") {
        if (r > n) throw new Error("r no puede ser mayor que n.");
        out = fact(n) / (fact(r) * fact(n - r));
        label = `nCr(${n},${r})`;
      } else {
        if (r > n) throw new Error("r no puede ser mayor que n.");
        out = fact(n) / fact(n - r);
        label = `nPr(${n},${r})`;
      }
      const result = okResult(fmt(out));
      setCombinatoricsResult(result);
      addHistoryEntry({ mode: "Estadística (Combinatoria)", input: label, resultSummary: result.resultLatex ?? "" });
    } catch (e) {
      setCombinatoricsResult(errResult(e instanceof Error ? e.message : "Error desconocido."));
    }
  }

  // --- Distribución ---
  const [distribution, setDistribution] = useState<Distribution>("binomial");
  const [binN, setBinN] = useState("10");
  const [binP, setBinP] = useState("0.3");
  const [binK, setBinK] = useState("3");
  const [mu, setMu] = useState("0");
  const [sigma, setSigma] = useState("1");
  const [normX, setNormX] = useState("0");
  const [normA, setNormA] = useState("-1");
  const [normB, setNormB] = useState("1");
  const [distributionResult, setDistributionResult] = useState<MathResult | null>(null);

  function runBinomial(query: BinomialQuery) {
    try {
      const n = Number(binN);
      const p = Number(binP);
      const k = Number(binK);
      let out: number;
      switch (query) {
        case "pmf":
          out = binomialPMF(n, p, k);
          break;
        case "cdf":
          out = binomialCDF(n, p, k);
          break;
        case "survival":
          out = binomialSurvival(n, p, k);
          break;
        case "mean":
          out = binomialMean(n, p);
          break;
        case "variance":
          out = binomialVariance(n, p);
          break;
      }
      setDistributionResult(okResult(fmt(out)));
    } catch (e) {
      setDistributionResult(errResult(e instanceof Error ? e.message : "Error desconocido."));
    }
  }

  function runNormal(query: NormalQuery) {
    try {
      const m = Number(mu);
      const s = Number(sigma);
      let out: number;
      switch (query) {
        case "cdf":
          out = normalCDF(m, s, Number(normX));
          break;
        case "range":
          out = normalRange(m, s, Number(normA), Number(normB));
          break;
        case "zscore":
          out = zScore(m, s, Number(normX));
          break;
      }
      setDistributionResult(okResult(fmt(out)));
    } catch (e) {
      setDistributionResult(errResult(e instanceof Error ? e.message : "Error desconocido."));
    }
  }

  const inputClass = "rounded-lg bg-chrome-soft px-2 py-1.5 text-sm text-bone";
  const btnClass = "rounded-lg bg-chrome-soft py-2 text-center text-xs text-bone hover:bg-chrome-soft/70";
  const btnPrimaryClass = "rounded-lg bg-marker-soft/10 py-2 text-center text-xs font-medium text-marker hover:bg-marker-soft/20";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 p-4 md:max-w-lg lg:max-w-2xl dt:max-w-3xl">
      <div className="flex gap-1 rounded-lg bg-chrome p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubMode(t.id)}
            className={
              subMode === t.id
                ? "flex-1 rounded-md bg-marker-soft/15 py-1.5 text-marker"
                : "flex-1 rounded-md py-1.5 text-bone/60 hover:text-bone"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {subMode === "descriptive" && (
        <div className="flex flex-col gap-3">
          <DataListInput values={dataChips} onChange={setDataChips} label="Datos" />
          <div className="grid grid-cols-3 gap-1.5">
            <button className={btnClass} onClick={() => runDescriptive("mean")}>x̄</button>
            <button className={btnClass} onClick={() => runDescriptive("median")}>Mediana</button>
            <button className={btnClass} onClick={() => runDescriptive("mode")}>Moda</button>
            <button className={btnClass} onClick={() => runDescriptive("sum")}>Σx</button>
            <button className={btnClass} onClick={() => runDescriptive("sumsq")}>Σx²</button>
            <button className={btnClass} onClick={() => runDescriptive("n")}>n</button>
            <button className={btnClass} onClick={() => runDescriptive("min")}>Min</button>
            <button className={btnClass} onClick={() => runDescriptive("max")}>Max</button>
            <button className={btnClass} onClick={() => runDescriptive("range")}>Rango</button>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-chrome-soft px-2 py-1.5">
            <span className="text-sm text-bone">σ² / s²</span>
            <div className="flex gap-1 rounded-md bg-chrome p-0.5">
              <button
                onClick={() => setVarianceKind("population")}
                className={
                  varianceKind === "population"
                    ? "rounded px-2 py-0.5 text-xs bg-marker text-chrome"
                    : "rounded px-2 py-0.5 text-xs text-bone/60"
                }
              >
                Poblac.
              </button>
              <button
                onClick={() => setVarianceKind("sample")}
                className={
                  varianceKind === "sample"
                    ? "rounded px-2 py-0.5 text-xs bg-marker text-chrome"
                    : "rounded px-2 py-0.5 text-xs text-bone/60"
                }
              >
                Muestral
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button className={btnPrimaryClass} onClick={() => runDescriptive("variance")}>σ²/s²</button>
            <button className={btnPrimaryClass} onClick={() => runDescriptive("stdev")}>σ/s</button>
          </div>
          <ResultPanel result={descriptiveResult} />
        </div>
      )}

      {subMode === "combinatorics" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <label className="flex-1 text-sm text-muted">
              n
              <input value={nStr} onChange={(e) => setNStr(e.target.value)} className={`${inputClass} mt-1 w-full`} />
            </label>
            <label className="flex-1 text-sm text-muted">
              r
              <input value={rStr} onChange={(e) => setRStr(e.target.value)} className={`${inputClass} mt-1 w-full`} />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <button className={btnPrimaryClass} onClick={() => runCombinatorics("nCr")}>nCr</button>
            <button className={btnPrimaryClass} onClick={() => runCombinatorics("nPr")}>nPr</button>
            <button className={btnPrimaryClass} onClick={() => runCombinatorics("factorial")}>n!</button>
          </div>
          <ResultPanel result={combinatoricsResult} />
        </div>
      )}

      {subMode === "distribution" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-1 rounded-lg bg-chrome-soft p-1 text-sm">
            <button
              onClick={() => setDistribution("binomial")}
              className={distribution === "binomial" ? "flex-1 rounded-md bg-marker py-1.5 text-chrome" : "flex-1 rounded-md py-1.5 text-bone/60"}
            >
              Binomial
            </button>
            <button
              onClick={() => setDistribution("normal")}
              className={distribution === "normal" ? "flex-1 rounded-md bg-marker py-1.5 text-chrome" : "flex-1 rounded-md py-1.5 text-bone/60"}
            >
              Normal
            </button>
          </div>

          {distribution === "binomial" ? (
            <>
              <div className="flex gap-2">
                <label className="flex-1 text-sm text-muted">
                  n
                  <input value={binN} onChange={(e) => setBinN(e.target.value)} className={`${inputClass} mt-1 w-full`} />
                </label>
                <label className="flex-1 text-sm text-muted">
                  p
                  <input value={binP} onChange={(e) => setBinP(e.target.value)} className={`${inputClass} mt-1 w-full`} />
                </label>
                <label className="flex-1 text-sm text-muted">
                  k
                  <input value={binK} onChange={(e) => setBinK(e.target.value)} className={`${inputClass} mt-1 w-full`} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button className={btnClass} onClick={() => runBinomial("pmf")}>P(X=k)</button>
                <button className={btnClass} onClick={() => runBinomial("cdf")}>P(X≤k)</button>
                <button className={btnClass} onClick={() => runBinomial("survival")}>P(X≥k)</button>
                <button className={btnClass} onClick={() => runBinomial("mean")}>E[X]</button>
                <button className={`${btnClass} col-span-2`} onClick={() => runBinomial("variance")}>Var[X]</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <label className="flex-1 text-sm text-muted">
                  μ
                  <input value={mu} onChange={(e) => setMu(e.target.value)} className={`${inputClass} mt-1 w-full`} />
                </label>
                <label className="flex-1 text-sm text-muted">
                  σ
                  <input value={sigma} onChange={(e) => setSigma(e.target.value)} className={`${inputClass} mt-1 w-full`} />
                </label>
              </div>
              <label className="text-sm text-muted">
                x
                <input value={normX} onChange={(e) => setNormX(e.target.value)} className={`${inputClass} mt-1 w-full`} />
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button className={btnClass} onClick={() => runNormal("cdf")}>P(X≤x)</button>
                <button className={btnClass} onClick={() => runNormal("zscore")}>z-score</button>
              </div>
              <div className="flex gap-2">
                <label className="flex-1 text-sm text-muted">
                  a
                  <input value={normA} onChange={(e) => setNormA(e.target.value)} className={`${inputClass} mt-1 w-full`} />
                </label>
                <label className="flex-1 text-sm text-muted">
                  b
                  <input value={normB} onChange={(e) => setNormB(e.target.value)} className={`${inputClass} mt-1 w-full`} />
                </label>
              </div>
              <button className={btnClass} onClick={() => runNormal("range")}>P(a≤X≤b)</button>
            </>
          )}
          <ResultPanel result={distributionResult} />
        </div>
      )}
    </div>
  );
}
