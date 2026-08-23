import type { Step } from "../types";

export function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-2 rounded-xl bg-panel p-4">
      {steps.map((step, i) => (
        <li key={step.id} className="border-b border-slate-800 pb-2 last:border-none">
          <p className="text-xs text-slate-500">Paso {i + 1}</p>
          <p className="text-lg text-slate-100">{step.latex}</p>
          <p className="text-sm text-slate-400">{step.explanation}</p>
        </li>
      ))}
    </ol>
  );
}
