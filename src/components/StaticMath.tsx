import { useEffect, useRef } from "react";
import "mathlive";

/**
 * Fase 2.6 (fix real del bug de display de fracciones — reportado dos
 * veces con capturas, el fix anterior no alcanzó):
 *
 * El fix de Fase 2.5 (importar `mathlive/static.css`) seguía sin
 * funcionar en casos reales: "6/5" en modo mixto mostraba "1" y "51"
 * sueltos en vez de "1 1/5" apilado, y en modo impropia mostraba "56" en
 * vez de "6/5" con barra. La causa real: `convertLatexToMarkup()` genera
 * HTML en el DOM normal ("light DOM"), sujeto al reset de Tailwind
 * (`@tailwind base`) y a cualquier otro CSS de la página — pelear esa
 * cascada de especificidad no es verificable sin un navegador real, y
 * evidentemente no alcanzaba con solo importar el stylesheet.
 *
 * Este componente reemplaza esa técnica por un `<math-field readonly>`
 * — el MISMO mecanismo que ya garantiza que el campo de ENTRADA
 * (NaturalInput.tsx) se vea bien SIEMPRE: Shadow DOM. El contenido
 * dentro de un Shadow DOM está completamente aislado del CSS de la
 * página — Tailwind no puede tocarlo, sin importar el orden de imports
 * ni la especificidad de ningún selector. Es además lo que MathLive
 * documenta como la vía recomendada para mostrar matemática estática
 * (mathlive.io/mathfield/guides/static/): `<math-span>`/`<math-div>` si
 * la versión los soporta, o un `<math-field readonly>` si no. La
 * versión instalada acá (0.100.0) no trae `<math-span>`/`<math-div>`
 * (verificado contra el bundle real, 0 coincidencias) — de ahí
 * `readonly` en vez de esos.
 */

interface StaticMathProps {
  latex: string;
  className?: string;
}

type MathFieldLike = HTMLElement & { value: string; readOnly: boolean };

export function StaticMath({ latex, className }: StaticMathProps) {
  const ref = useRef<MathFieldLike>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Se fija por JS además del atributo JSX de abajo — el atributo
    // cubre el render inicial, esto cubre updates y es la fuente de
    // verdad documentada por la API de MathfieldElement.
    el.readOnly = true;
    if (el.value !== latex) el.value = latex;
  }, [latex]);

  return (
    <math-field
      ref={ref as React.RefObject<HTMLElement>}
      read-only
      tabIndex={-1}
      aria-readonly="true"
      className={className}
      style={
        {
          background: "transparent",
          border: "none",
          padding: 0,
          display: "inline-block",
          // Sin esto el read-only todavía muestra un cursor de texto al
          // pasar el mouse — es contenido, no un campo editable.
          cursor: "default",
        } as React.CSSProperties
      }
      virtual-keyboard-mode="off"
    />
  );
}
