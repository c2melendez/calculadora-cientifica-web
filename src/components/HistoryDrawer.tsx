import type { ReactNode } from "react";

// P2 (spec v2 §3): drawer unificado de Historial.
// - lg/dt: <aside> en flujo normal dentro de un flex row junto a <main>
//   (ver App.tsx) — al abrir consume ancho real y "empuja" el contenido,
//   no flota encima.
// - phone/tablet (<lg): overlay — fixed inset-0 en phone (pantalla
//   completa), deslizante desde la derecha cubriendo ~78% en tablet.
//   Cerrable con el botón X o tocando el backdrop.
// No reescribe HistoryPanel.tsx — solo lo envuelve vía `children`.
// HistoryLog.tsx (mini-cinta de sesión embebida en Screen.tsx) NO es
// parte de este drawer — es un componente distinto, no se toca aquí.

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function HistoryDrawer({ isOpen, onClose, children }: HistoryDrawerProps) {
  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        aria-label="Historial"
        className={
          isOpen
            ? "fixed inset-0 z-50 flex flex-col bg-chrome md:inset-y-0 md:left-auto md:right-0 md:w-[78%] lg:static lg:inset-auto lg:z-auto lg:w-[260px] lg:shrink-0 lg:border-l lg:border-chrome-soft dt:w-[280px]"
            : "hidden lg:block lg:w-0 lg:shrink-0 lg:overflow-hidden lg:transition-[width] lg:duration-200"
        }
      >
        <div className="flex items-center justify-between border-b border-chrome-soft p-3 lg:hidden">
          <span className="text-sm font-medium text-bone">Historial</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar historial"
            className="rounded p-1 text-bone/70 hover:text-bone"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto lg:w-[260px] dt:w-[280px]">{children}</div>
      </aside>
    </>
  );
}
