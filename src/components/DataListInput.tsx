// components/DataListInput.tsx — P6 (spec v2 §7.1): lista de datos de
// longitud variable para el sub-modo Descriptiva. Reutiliza visualmente
// el patrón de MatrixGridInput.tsx (mismos tokens de color/radio) pero en
// 1D, con chips agregables/removibles en vez de una grilla fija de
// celdas — el número de valores no está acotado de antemano como sí lo
// está una matriz (máx. 4x4).

import { useState, type KeyboardEvent } from "react";

interface DataListInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  label: string;
}

export function DataListInput({ values, onChange, label }: DataListInputProps) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const trimmed = draft.trim();
    if (trimmed === "") return;
    onChange([...values, trimmed]);
    setDraft("");
  }

  function removeAt(index: number) {
    onChange(values.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && values.length > 0) {
      // Igual que un campo de "chips" convencional: backspace con el
      // campo vacío borra el último chip, no requiere apuntar al botón ×.
      removeAt(values.length - 1);
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm text-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-chrome p-2">
        {values.map((v, i) => (
          <span
            key={i}
            className="flex items-center gap-1 rounded-full bg-chrome-soft px-2.5 py-1 text-sm text-bone"
          >
            {v}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Quitar ${v}`}
              className="text-bone/50 hover:text-bone"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={values.length === 0 ? "Escribe un valor y presiona Enter" : "+"}
          className="min-w-[64px] flex-1 bg-transparent px-1 py-1 text-sm text-bone placeholder:text-bone/40 focus:outline-none"
        />
      </div>
    </div>
  );
}

export function parseDataList(values: string[]): number[] {
  return values.map((v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`"${v}" no es un número válido.`);
    return n;
  });
}
