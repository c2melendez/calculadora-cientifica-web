// engine/distributions.ts — P6 (spec v2 §7.3): distribuciones Binomial y
// Normal. A diferencia de statFunctions.ts/complexFunctions.ts, estas
// funciones NO se llaman desde el campo de expresión libre (la spec no
// pide una tecla de teclado para esto — es un sub-modo de UI dedicado,
// con campos numéricos n/p/μ/σ, igual que Combinatoria) — reciben
// parámetros numéricos directos desde StatisticsMode.tsx, no expresiones
// LaTeX/Algebrite a evaluar.
//
// erf (necesaria para la CDF normal): NO pude ejecutar
// `Algebrite.run("erf(1)")` en este entorno (sin red, sin node_modules)
// para confirmar si Algebrite la resuelve numéricamente de forma
// confiable, como pide verificar la spec (§7.3). Sin esa confirmación
// empírica, implemento erf en JS puro directamente (aproximación
// Abramowitz-Stegun 7.1.26, error máximo ~1.5×10⁻⁷) — no depende de si
// Algebrite la soporta o no, así que funciona de cualquier forma. Mismo
// criterio de "ruta segura sin poder verificar" que complexFunctions.ts
// (P4).

/** Aproximación Abramowitz-Stegun 7.1.26. Error máximo ~1.5e-7. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) throw new Error(`factorial requiere un entero no negativo, se recibió ${n}.`);
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  return factorial(n) / (factorial(k) * factorial(n - k));
}

function validateBinomialParams(n: number, p: number): void {
  if (!Number.isInteger(n) || n < 0) throw new Error("n debe ser un entero no negativo.");
  if (p < 0 || p > 1) throw new Error("p debe estar entre 0 y 1.");
}

/** P(X=k) — función de masa de probabilidad. */
export function binomialPMF(n: number, p: number, k: number): number {
  validateBinomialParams(n, p);
  if (!Number.isInteger(k) || k < 0 || k > n) throw new Error(`k debe ser un entero entre 0 y n (${n}).`);
  return combinations(n, k) * p ** k * (1 - p) ** (n - k);
}

/** P(X≤k) — suma acumulada de la PMF, k=0..k. */
export function binomialCDF(n: number, p: number, k: number): number {
  validateBinomialParams(n, p);
  let sum = 0;
  for (let i = 0; i <= Math.min(k, n); i++) sum += binomialPMF(n, p, i);
  return sum;
}

/** P(X≥k) = 1 - P(X≤k-1). */
export function binomialSurvival(n: number, p: number, k: number): number {
  return 1 - binomialCDF(n, p, k - 1);
}

export function binomialMean(n: number, p: number): number {
  validateBinomialParams(n, p);
  return n * p;
}

export function binomialVariance(n: number, p: number): number {
  validateBinomialParams(n, p);
  return n * p * (1 - p);
}

function validateNormalParams(sigma: number): void {
  if (sigma <= 0) throw new Error("σ debe ser mayor que 0.");
}

/** P(X≤x) — CDF de la normal, vía erf. */
export function normalCDF(mu: number, sigma: number, x: number): number {
  validateNormalParams(sigma);
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

/** P(a≤X≤b) = CDF(b) - CDF(a). */
export function normalRange(mu: number, sigma: number, a: number, b: number): number {
  return normalCDF(mu, sigma, b) - normalCDF(mu, sigma, a);
}

export function zScore(mu: number, sigma: number, x: number): number {
  validateNormalParams(sigma);
  return (x - mu) / sigma;
}
