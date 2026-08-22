# SPEC: Calculadora Científica/Simbólica Web — v10 (sin backend, PWA, GitHub Pages)

> Referencia técnica completa y autosuficiente. Reemplaza a `spec_calculadora_cientifica_v9.md`: elimina el backend Python/FastAPI/SymPy y lo sustituye por un motor 100% cliente (JS/TS), pensado para instalarse como PWA y alojarse gratis en GitHub Pages. Amplía el alcance funcional según `Prompt.md` (calculadora científica, álgebra, cálculo, sistemas de ecuaciones, matrices, graficación con análisis, fracciones).

## Objetivo del proyecto

App web instalable (PWA) con seis modos de cálculo, teclado matemático convencional e **ingreso de pantalla natural** (notación matemática real, tipo Symbolab/Photomath — fracciones apiladas, exponentes, raíces, no texto plano), que corre enteramente en el navegador y se despliega como sitio estático en GitHub Pages.

---

## 1. Diferencias fundamentales frente a v9 (léase primero)

| Aspecto | v9 (Python) | v10 (esta spec) |
|---|---|---|
| Motor simbólico | SymPy (backend) | **Algebrite** (cliente) — CAS más cercano a SymPy disponible en JS |
| Aritmética exacta/fracciones | SymPy `Rational` | **fraction.js** — fracciones propias/impropias/mixtas + decimal |
| Input | Texto plano validado por parser propio | **MathLive** — campo de edición matemático real (LaTeX en vivo), igual al de las imágenes de referencia |
| Backend | FastAPI + endpoints REST | **Ninguno** — todo corre en el navegador |
| Hosting | Requiere servidor | **GitHub Pages** (sitio estático, gratis, sin cold starts) |
| Persistencia/historial | N/A (fuera de alcance v9) | `localStorage`/`IndexedDB` del navegador |
| Límites de complejidad | Impuestos en servidor compartido | Impuestos en el dispositivo del propio usuario (mismo mecanismo, distinto lugar) |

**Advertencia honesta de cobertura**: Algebrite no iguala a SymPy en integrales no triviales ni en garantías de simplificación. Para el modo Graficación (extremos, inflexión), la spec exige un **enfoque híbrido**: intento simbólico primero, fallback numérico (muestreo + bisección/Newton) cuando el simbólico no resuelva — ver sección 8. Esto debe quedar visible para el usuario (ver `ResultConfidence` en sección 4).

---

## 2. Stack tecnológico

- **Framework**: React 18 + Vite + TypeScript.
- **Estilos**: Tailwind CSS.
- **Input matemático natural**: **MathLive** (`mathlive`) — campo `<math-field>` con teclado virtual configurable por modo.
- **Motor simbólico**: **Algebrite** — simplificación, derivadas, integrales, límites, resolución de ecuaciones/sistemas, operaciones matriciales.
- **Fracciones exactas**: **fraction.js** — conversión a fracción propia/impropia/mixta + decimal, usado como capa sobre los resultados numéricos de Algebrite.
- **Renderizado matemático de salida**: **KaTeX** (igual que v9).
- **Graficación**: **function-plot** (sobre D3) para 2D — más liviano que Plotly.js para uso 100% cliente; incluye zoom/pan táctil, relevante para móvil.
- **Estado**: Zustand.
- **PWA**: `vite-plugin-pwa` — genera manifest, service worker (cache-first para assets, network-first no aplica al no haber red que consultar salvo CDN de fuentes), instalable en Android/iOS/desktop.
- **Persistencia local**: IndexedDB vía `idb` para historial (más robusto que `localStorage` para payloads grandes tipo gráficas).
- **Routing**: hash routing (`react-router` con `HashRouter`) — evita el problema de rutas del lado servidor en GitHub Pages.

> No añadir dependencias nuevas sin justificar. Todas las versiones se fijan en `package.json` con lockfile (`package-lock.json` o `pnpm-lock.yaml`) commiteado.

---

## 3. Arquitectura sin backend

```
/src
  /engine        (capa de abstracción sobre Algebrite — nunca se llama a Algebrite
                  directamente desde componentes UI)
    algebriteClient.ts   (wrapper único; normaliza errores de Algebrite a AppError)
    fractions.ts         (wrapper sobre fraction.js: toProperFraction, toMixed, toDecimal)
    stepEngine/          (generación de pasos por tipo: derivative, integral, algebra,
                          matrix, system) — cada archivo expone steps(input): Step[]
    numericFallback.ts   (muestreo + búsqueda de raíces para extremos/inflexión cuando
                          el análisis simbólico falla)
    complexityGuard.ts   (límites de tiempo/tamaño ejecutados en un Web Worker, ver §9)
  /modes
    BasicScientific/
    Algebra/
    Calculus/
    LinearSystems/
    Matrices/
    Graphing/
  /components    (MathKeyboard, NaturalInput [wrapper de MathLive], ResultPanel,
                  StepList, GraphViewer, HistoryPanel, FractionToggle, ErrorBoundary)
  /store         (useUIStore, useHistoryStore, useModeStore)
  /workers       (compute.worker.ts — TODO el cálculo pesado corre aquí, nunca en el
                  hilo principal, para no congelar la UI en móvil)
  /pwa           (manifest.json, iconos, sw-config)
  types.ts
  App.tsx
/tests           (Vitest + Testing Library; Playwright para E2E)
public/
  icons/ (192, 512, maskable)
  manifest.webmanifest
index.html
vite.config.ts   (incluye plugin PWA + configuración de HashRouter-safe base path)
```

**Regla de capa dura**: ningún componente de `/modes` o `/components` importa `algebrite` directamente. Todo pasa por `/engine`. Esto es lo que permite, si en el futuro se cambia Algebrite por otra librería (o se reintroduce un backend opcional), tocar solo `/engine`.

**Web Worker obligatorio**: todo cálculo simbólico corre en `compute.worker.ts`, nunca en el hilo principal. Esto es más crítico aquí que en v9, porque no hay servidor que absorba el costo — si un cálculo cuelga el hilo principal, la app entera se congela en el teléfono del usuario.

---

## 4. Contrato de datos (equivalente al `MathResponse` de v9)

```typescript
type ResultConfidence = "SYMBOLIC" | "NUMERIC_FALLBACK" | "PARTIAL";

interface Step {
  id: string;
  latex: string;
  explanation: string;
}

interface FractionResult {
  improperLatex: string;   // "63/4"
  mixedLatex: string | null; // "15 3/4" — null si numerador < denominador
  decimal: string;          // "15.75", truncado/redondeado según §7
}

interface MathResult {
  success: boolean;
  errorCode?: ErrorCode;          // enum central, igual filosofía que v9
  resultLatex: string | null;
  fraction?: FractionResult;      // presente cuando el resultado es racional
  steps: Step[];
  hasDetailedSteps: boolean;
  confidence: ResultConfidence;   // NUEVO respecto a v9 — visibiliza el fallback numérico
  requestId: string;              // uuid generado en cliente, para logs/histórico local
}

enum ErrorCode {
  PARSE_ERROR = "PARSE_ERROR",
  UNSUPPORTED_OPERATION = "UNSUPPORTED_OPERATION",
  COMPLEXITY_LIMIT = "COMPLEXITY_LIMIT",
  DIMENSION_MISMATCH = "DIMENSION_MISMATCH",
  DOMAIN_ERROR = "DOMAIN_ERROR",       // ej. raíz de negativo en modo real, log de negativo
  TIMEOUT = "TIMEOUT",
  NUMERIC_FALLBACK_FAILED = "NUMERIC_FALLBACK_FAILED",
}
```

Todo modo consume/produce `MathResult`. `confidence: "NUMERIC_FALLBACK"` se muestra en la UI con un indicador visible (no silencioso) — el usuario debe poder distinguir "esto lo resolvió el CAS" de "esto lo aproximó por muestreo".

---

## 5. Modo 1 — Calculadora básica/científica

- Teclado convencional (según Imagen 1/3 de referencia): dígitos, `+ − × ÷`, `%`, `a/b` (fracción), `√`, `ⁿ√`, `a²`, `aᵇ`, `|a|`, `sin cos tan` (+ inversas), `ln log`, `e`, `π`, paréntesis, `ans` (resultado anterior), `RAD`/`GRAD` toggle, deshacer/rehacer, borrar todo.
- Pestañas de teclado: `ppal` (principal), `abc` (variables, para cuando el usuario quiere definir expresiones con letras), `fnc` (funciones avanzadas: `sin⁻¹`, `mean`, `stdev`, `stdevp`, `nPr`, `nCr`, `!`, `round`) — igual estructura que Imágenes 1-3.
- Input natural vía MathLive: el usuario ve fracciones apiladas, exponentes elevados, raíces con índice, igual que Imagen 4/5.
- Resultado: `FractionResult` cuando aplica (Imagen 5: `15 3/4 = 63/4`), más el equivalente decimal siempre visible.
- `RAD`/`GRAD` (grados) — nota: Prompt.md pide "RAD/GRAD" como en la imagen; **DEDUCIBLE**: se interpreta como radianes/grados sexagesimales (no gradianes), por ser el estándar de toda calculadora científica de consumo. Si se quisiera soporte real de gradianes (400 en el círculo completo) habría que ampliarlo — se deja como TODO explícito, no se implementa sin confirmación.

---

## 6. Modo 2 — Álgebra (ecuaciones)

- Resuelve ecuaciones de una variable (igual alcance que `/solve` en v9) con teclado convencional + input natural.
- Pasos de aislamiento de variable generados por `stepEngine/algebra.ts`.
- Soluciones múltiples (ej. cuadráticas) se listan todas, cada una con su `FractionResult` si es racional.
- Soluciones complejas: se muestran con `i`, mismo criterio que v9 §9.

---

## 7. Modo 3 — Cálculo (límites, derivadas, integrales)

- **Límites**: `lim_{x→a} f(x)`, incluyendo `a = ∞`/`-∞` y límites laterales — Algebrite tiene soporte directo, se usa passthrough con pasos limitados (no siempre puede generar procedimiento detallado; cuando no puede, `hasDetailedSteps: false` y se muestra solo el resultado, igual filosofía que los stubs de v9).
- **Derivadas**: orden 1-3 (se reduce de 1-5 en v9 a 1-3 aquí — **DEDUCIBLE**, porque generar pasos verificados de orden 4-5 en el navegador sin SymPy es de alto riesgo de `COMPLEXITY_LIMIT`; ampliar solo si se confirma que Algebrite lo soporta con suficiente estabilidad).
- **Integrales indefinidas y definidas**: passthrough a Algebrite con pasos best-effort. Cuando Algebrite no resuelve una integral (caso frecuente en integrales no elementales), se devuelve `ErrorCode.UNSUPPORTED_OPERATION` con mensaje claro — nunca se inventa un resultado aproximado sin marcarlo como `NUMERIC_FALLBACK` explícito (integración numérica tipo Simpson como fallback opcional, declarado en el resultado).

---

## 8. Modo 4 — Sistemas de ecuaciones

- Sistemas lineales de 2 a 4 variables (Prompt.md no especifica límite; **DEDUCIBLE** por paridad con matrices hasta 4x4 de v9).
- Resolución vía matriz aumentada + Gauss-Jordan (reutiliza el motor de matrices, sección 9) — pasos mostrados como operaciones de fila.
- Casos: solución única, infinitas soluciones (sistema compatible indeterminado), sin solución (incompatible) — los tres deben distinguirse explícitamente en el resultado, no solo devolver "no resuelto".

---

## 9. Modo 5 — Matrices

- Operaciones: suma, resta, multiplicación, transposición, determinante, inversa, potencia (`Aⁿ`, n entero ≥ 0; **AMBIGUO** si Prompt.md espera potencias negativas equivalentes a `(A⁻¹)ⁿ` — se marca ambiguo y se implementa solo potencia no negativa hasta confirmación).
- Tamaño: hasta 4x4 con pasos detallados (igual que v9); 5x5 en adelante, resultado directo sin procedimiento completo (mismo criterio de v9 §11).
- Validaciones antes de calcular: `DIMENSION_MISMATCH` para suma/resta/multiplicación con dimensiones incompatibles; matriz singular → mensaje explícito en inversa (no `NaN` silencioso).

---

## 10. Modo 6 — Graficación con análisis

Requisito más exigente de todo el proyecto (Prompt.md ítem 8): dominio, rango, intersecciones con ejes, máximos/mínimos (globales y locales), vértices, puntos de inflexión.

**Enfoque híbrido obligatorio**:
1. Intento simbólico: derivada (Algebrite) → resolver `f'(x)=0` → clasificar con `f''(x)` (signo) → candidatos a extremos/inflexión.
2. Si el paso simbólico falla (ecuación no resoluble algebraicamente por Algebrite): fallback numérico — muestreo denso del dominio visible + detección de cambios de signo en `f'` (extremos) y `f''` (inflexión) vía bisección. Resultado marcado `confidence: "NUMERIC_FALLBACK"`.
3. Dominio: para funciones racionales/raíces/logaritmos, análisis simbólico de restricciones (denominador ≠ 0, radicando ≥ 0, argumento de log > 0); si la función es demasiado compuesta para eso, se reporta dominio aproximado por muestreo con advertencia explícita.
4. Rango: análogo — exacto cuando es derivable del análisis de extremos; aproximado (basado en muestreo del dominio visible) en el resto de los casos, siempre etiquetado.
5. Vértices: aplica específicamente a cónicas (parábolas) — cálculo directo por fórmula, no depende del fallback numérico.

Esta sección es la de mayor riesgo del proyecto. Se recomienda tratarla como su propia fase al final (ver plan de fases, sección 12), después de validar que el resto del motor simbólico funciona bien.

---

## 11. Fracciones (transversal a todos los modos)

- Todo resultado racional se expresa como: fracción impropia, fracción mixta (si aplica, es decir numerador ≥ denominador tras simplificar), y decimal.
- Decimal: si es periódico o de más de 10 dígitos significativos, se trunca a 10 y se indica con `…` (mismo criterio que v9 §`result_latex` largo → advertencia, adaptado a decimales).
- El usuario puede alternar la vista (impropia/mixta/decimal) sin recalcular — se guardan los tres formatos en `FractionResult` desde el cálculo original.

---

## 12. PWA y responsive

- `vite-plugin-pwa` con estrategia `autoUpdate`; manifest con iconos 192/512 + maskable, `display: "standalone"`, orientación libre.
- Instalable desde Android (Chrome "Añadir a pantalla de inicio") e iOS (Safari "Compartir → Añadir a inicio" — con las limitaciones conocidas de iOS para PWAs, que no soporta notificaciones push pero sí instalación offline básica; esto se documenta en el README como limitación de plataforma, no de la app).
- Diseño responsive: teclado y `NaturalInput` deben adaptarse a pantallas desde ~320px de ancho; el teclado científico completo puede requerir scroll horizontal o pestañas colapsables en pantallas muy pequeñas (se define en el módulo de frontend correspondiente, no aquí).
- Todo cálculo en Web Worker (sección 3) es crítico en este punto: en un teléfono de gama baja, una operación matricial de 4x4 sin worker puede congelar el hilo principal perceptiblemente.

---

## 13. Hosting en GitHub Pages

- Build: `npm run build` (Vite) → carpeta `dist/`.
- Despliegue: GitHub Actions (`.github/workflows/deploy.yml`) que compila y publica `dist/` a la rama `gh-pages` en cada push a `main`. No se hace deploy manual.
- `vite.config.ts` debe fijar `base: '/<nombre-del-repo>/'` para que los assets resuelvan correctamente bajo la subruta de GitHub Pages.
- Routing: `HashRouter` evita el problema clásico de 404 en rutas SPA de GitHub Pages sin necesidad del truco de `404.html`.
- HTTPS y Service Worker: GitHub Pages sirve por HTTPS por defecto, requisito para que el Service Worker de la PWA funcione.

---

## 14. Definition of Done (por módulo)

- Compila (`npm run build`) y pasa `npm run typecheck` sin errores.
- Todo cálculo pesado corre en `compute.worker.ts`, nunca bloquea el hilo principal.
- Ningún componente UI importa `algebrite` directamente (regla de capa dura, §3).
- `FractionResult` presente en todo resultado racional, con los tres formatos.
- Errores usan el `ErrorCode` central; nunca se muestra un error técnico crudo (stack trace de Algebrite) al usuario.
- `confidence: "NUMERIC_FALLBACK"` se refleja visualmente en la UI cuando aplica — no queda implícito.
- Responsive verificado en al menos un viewport móvil (~375px) y uno de escritorio.
- Evidencia de tests según el nivel acordado en el Mensaje 0 de la plantilla de módulos (mismo esquema de 3 niveles que v9).
- README actualizado con: instrucciones de build/deploy a GitHub Pages, limitaciones conocidas de cada modo (especialmente graficación §10), y estado PWA (instalable, offline parcial).

---

## 15. Limitaciones conocidas (declarar en README desde el Módulo 1)

- Algebrite no resuelve todas las integrales que SymPy sí resuelve; se reporta `UNSUPPORTED_OPERATION` en vez de forzar un resultado.
- El análisis de dominio/rango/extremos en graficación puede degradar a aproximación numérica (§10) para funciones muy compuestas.
- Derivadas limitadas a orden 3 (vs. 5 en v9) hasta validar estabilidad de Algebrite en órdenes superiores.
- Rendimiento en dispositivos de gama baja depende de que el Web Worker esté correctamente implementado desde el Módulo 1 de infraestructura — no es opcional.
- PWA en iOS tiene soporte offline más limitado que en Android/desktop (limitación de la plataforma, no del código).

---

## 16. Mejoras fuera de alcance (explícitamente no incluidas en esta versión)

Gráficas 3D/paramétricas, ecuaciones diferenciales, series de Taylor con pasos completos, exportar historial, multi-idioma, modo oscuro (a menos que se pida), sincronización en la nube del historial (contradice "sin backend").
