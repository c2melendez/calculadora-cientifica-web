import type { Step } from "../types";

// Ficha de paso tipo "margen de cuaderno" (Fase 1 — sistema de diseño
// Precision Lab). Se degrada con elegancia cuando el motor (Algebrite) no
// provee title/rule/latexBefore: en ese caso solo se muestra el resultado
// del paso y su explicación, sin dejar espacios vacíos ni etiquetas "N/A".
// Ver auditoría Fase 0, Opción 2 de paridad del modelo de datos.

export function StepList({ steps, activeIndex }: { steps: Step[]; activeIndex?: number }) {
  if (steps.length === 0) return null;

  return (
    <ol className="relative flex flex-col gap-3.5 pl-5" aria-label="Procedimiento paso a paso">
      <div className="absolute bottom-1 left-[9px] top-1 w-px bg-paper-line" aria-hidden="true" />

      {steps.map((step, i) => {
        const isActive = activeIndex === i;
        return (
          <li key={step.id} className="relative">
            <span
              className={
                isActive
                  ? "absolute -left-5 top-0.5 h-3 w-3 rounded-full bg-marker ring-4 ring-marker-soft"
                  : "absolute -left-5 top-0.5 h-3 w-3 rounded-full border-2 border-paper-line bg-paper"
              }
              aria-hidden="true"
            />
            <div className={isActive ? "-mx-2.5 rounded-lg border-l-[3px] border-marker bg-marker-soft p-2.5" : ""}>
              {step.title && (
                <p className={isActive ? "text-sm font-medium text-marker-text" : "text-sm font-medium text-muted"}>
                  {step.title}
                </p>
              )}
              {step.rule && <p className="font-mono text-xs text-muted">{step.rule}</p>}
              {step.latexBefore ? (
                <p className="mt-1 font-mono text-sm text-ink">
                  {step.latexBefore} <span className="text-muted">→</span> {step.latex}
                </p>
              ) : (
                <p className="mt-1 font-mono text-sm text-ink">{step.latex}</p>
              )}
              <p className="mt-0.5 text-sm text-muted">{step.explanation}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
