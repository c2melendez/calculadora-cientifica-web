import { useEffect, useRef } from "react";
import "mathlive";

// Wrapper único sobre el <math-field> de MathLive (spec v10 §5). Expone
// getValue()/setValue() en LaTeX y un evento onChange, para que el resto de
// la app nunca dependa directamente de la API de MathLive.

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      // Extiende las props estándar con los atributos propios de MathLive
      // que no son HTML estándar y por lo tanto no están en HTMLAttributes
      // (placeholder tampoco está en HTMLAttributes<HTMLElement> genérico
      // porque normalmente es exclusivo de <input>/<textarea> — se agrega
      // aquí a mano). Bug detectado contra la build real de GitHub Actions:
      // la versión anterior de este tipo rechazaba ambos atributos.
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
}

export interface NaturalInputHandle {
  insert: (latex: string) => void;
  clear: () => void;
}

export function NaturalInput({ value, onChange, placeholder }: NaturalInputProps) {
  const ref = useRef<HTMLElement & { value: string }>(null);

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
      ref={ref as never}
      className="w-full rounded-lg bg-panel px-4 py-3 text-2xl text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-accent"
      // "virtual-keyboard-mode" en off: el teclado propio de la app
      // (MathKeyboard) reemplaza al teclado virtual por defecto de MathLive
      // — spec v10 §5. Ya no hace falta @ts-expect-error aquí: el tipo de
      // arriba declara explícitamente este atributo.
      virtual-keyboard-mode="off"
      placeholder={placeholder}
    />
  );
}
