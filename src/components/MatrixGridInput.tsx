// Grilla de entrada de matriz — spec v10 §9 (hasta 4x4). Usa <input>
// simples en vez de NaturalInput por celda: TODO declarado, ver README del
// Módulo 6 sobre por qué no se usó MathLive aquí.

interface MatrixGridInputProps {
  rows: number;
  cols: number;
  values: string[][];
  onChange: (values: string[][]) => void;
  label: string;
}

export function MatrixGridInput({ rows, cols, values, onChange, label }: MatrixGridInputProps) {
  const setCell = (r: number, c: number, value: string) => {
    const next = values.map((row) => [...row]);
    next[r][c] = value;
    onChange(next);
  };

  return (
    <div>
      <p className="mb-1 text-sm text-muted">{label}</p>
      <div
        className="inline-grid gap-1 rounded-lg bg-chrome p-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => (
            <input
              key={`${r}-${c}`}
              value={values[r]?.[c] ?? ""}
              onChange={(e) => setCell(r, c, e.target.value)}
              className="w-14 rounded bg-chrome-soft px-1 py-1 text-center text-bone"
              placeholder="0"
            />
          )),
        )}
      </div>
    </div>
  );
}

export function makeEmptyMatrix(rows: number, cols: number): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));
}
