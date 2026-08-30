import { useState } from "react";

// Fase A: el interruptor DEG/RAD sale del teclado y vive en un ícono con
// popover en la barra superior de cada modo (spec UX §1, calcada de
// ClassCalc) — antes era un ModKey dentro de MathKeyboard.

interface AngleModePopoverProps {
  angleMode: "RAD" | "GRAD";
  onToggle: () => void;
  /** Fase E: 'chrome' (default, look original) para cuando vive en el
   * header oscuro; 'paper' para cuando vive dentro de la pantalla clara
   * de Screen.tsx (mockup estilo ClassCalc) — mismo componente, distinto
   * contraste de fondo. */
  variant?: "chrome" | "paper";
}

export function AngleModePopover({ angleMode, onToggle, variant = "chrome" }: AngleModePopoverProps) {
  const [open, setOpen] = useState(false);
  const triggerClass =
    variant === "paper"
      ? "rounded-md bg-marker-soft px-2 py-1 text-[10px] font-semibold text-marker-text hover:bg-marker-soft/70"
      : "rounded-md bg-chrome-soft px-2 py-1.5 text-[10px] font-semibold text-bone hover:bg-chrome-soft/70";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Modo de ángulo: ${angleMode}. Abrir ajustes.`}
        aria-expanded={open}
        className={triggerClass}
      >
        {angleMode}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1.5 w-44 rounded-lg bg-chrome-soft p-3 shadow-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="text-bone/70">Ángulo:</span>
            <button
              onClick={onToggle}
              role="switch"
              aria-checked={angleMode === "GRAD"}
              className="relative h-5 w-9 rounded-full bg-chrome transition-colors"
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-marker transition-transform ${
                  angleMode === "GRAD" ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-bone/50">
            <span className={angleMode === "RAD" ? "text-marker" : ""}>RAD</span>
            <span className={angleMode === "GRAD" ? "text-marker" : ""}>GRAD</span>
          </div>
        </div>
      )}
    </div>
  );
}
