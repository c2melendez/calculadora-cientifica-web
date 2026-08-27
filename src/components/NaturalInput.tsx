import { useEffect, useRef } from "react";
import "mathlive";

// Wrapper único sobre el <math-field> de MathLive (spec v10 §5). Expone
// getValue()/setValue() en LaTeX y un evento onChange, para que el resto de
// la app nunca dependa directamente de la API de MathLive.
//
// Re-vestido con los tokens Precision Lab (Fase 1/2): vive sobre el panel
// "paper" (igual que su equivalente NaturalMathField.tsx en Precision Lab),
// con el caret y la selección de MathLive en marker.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        placeholder?: string;
        "virtual-keyboard-mode"?: string;
      };
    }
  }
}

interface NaturalInputProps {
  value: string;
  onChange: (latex: string) => void;
  placeholder?: string;
  /** Fase A: expone el elemento real de MathLive para que MathKeyboard use
   * field.insert() con plantillas #? — igual que Precision Lab (Python).
   * Antes el teclado insertaba con concatenación de texto ingenua; esto
   * corrige eso de una vez ya que estamos reescribiendo el teclado. */
  fieldRef?: (el: (HTMLElement & { value: string; insert: (s: string) => void; focus: () => void }) | null) => void;
}

export interface NaturalInputHandle {
  insert: (latex: string) => void;
  clear: () => void;
}

export function NaturalInput({ value, onChange, placeholder, fieldRef }: NaturalInputProps) {
  const ref = useRef<HTMLElement & { value: string; insert: (s: string) => void; focus: () => void }>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => onChange(el.value);
    el.addEventListener("input", handler);
    return () => el.removeEventListener("input", handler);
  }, [onChange]);

  useEffect(() => {
    const el = ref.current;
    if (el && el.value !== value) {
      el.value = value;
    }
  }, [value]);

  return (
    <math-field
      ref={(el: (HTMLElement & { value: string; insert: (s: string) => void; focus: () => void }) | null) => {
        (ref as React.MutableRefObject<typeof el>).current = el;
        fieldRef?.(el);
      }}
      className="w-full rounded-lg border border-paper-line bg-paper-soft px-4 py-3 text-2xl text-ink shadow-sm"
      style={
        {
          "--caret-color": "#E8A33D",
          "--selection-background-color": "#FBEFDA",
          "--selection-color": "#8A5A0E",
        } as React.CSSProperties
      }
      // "virtual-keyboard-mode" en off: el teclado propio de la app
      // (MathKeyboard) reemplaza al teclado virtual por defecto de MathLive
      // — spec v10 §5.
      virtual-keyboard-mode="off"
      placeholder={placeholder}
    />
  );
}
