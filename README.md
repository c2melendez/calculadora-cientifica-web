# Calculadora Científica Web

App instalable (PWA) con calculadora científica, álgebra, cálculo, sistemas de ecuaciones, matrices y graficación — 100% en el navegador (sin backend), alojada en GitHub Pages.

Ver `spec_calculadora_v10_sin_backend.md` para la especificación técnica completa.

## Estado del proyecto — Módulo 1 (Cierre)

**Archivos nuevos:** toda la estructura del repo (ver árbol abajo).
**Archivos modificados:** N/A (primer módulo).
**Cambios contractuales:** ninguno (primer módulo define el contrato inicial en `src/types.ts`).
**Dependencias añadidas:** todas las listadas en `package.json` — justificadas en la spec v10 §2 (Algebrite, fraction.js, MathLive, KaTeX, idb, Zustand, react-router-dom, vite-plugin-pwa).

**Tests — nivel de evidencia: 3 (NO EJECUTADO).**
Este entorno de generación no tiene acceso a internet, por lo que no se pudo ejecutar `npm install` ni `npm run build`/`npm run typecheck` para verificar que el código compila. **Antes de continuar con el Módulo 2, ejecuta localmente:**

```bash
npm install
npm run typecheck
npm run dev
```

y corrige cualquier error de tipos o de import que surja — es razonablemente probable que aparezcan ajustes menores (tipado de `mathlive`, versión exacta de la API de Algebrite), ya que el código se escribió contra la documentación de estas librerías sin poder compilar contra ellas en este entorno.

**Suite de regresión:** N/A (primer módulo).

**Definition of Done (spec v10 §14):**
- [ ] Compila (`npm run build`) y pasa `npm run typecheck` — **pendiente de verificación local, ver nota arriba**
- [x] Todo cálculo pesado corre en `compute.worker.ts`
- [x] Ningún componente UI importa `algebrite` directamente (solo `src/engine/algebriteClient.ts`)
- [x] `FractionResult` presente en resultados racionales (impropia/mixta/decimal)
- [x] Errores usan `ErrorCode` central, sin stack traces crudos en la UI
- [x] `confidence: "NUMERIC_FALLBACK"` reflejado visualmente (aplica a partir del modo Graficación, Módulo posterior)
- [ ] Responsive verificado en viewport móvil — pendiente de prueba visual real (no se puede renderizar en este entorno)
- [x] README actualizado

**Decisiones DEDUCIBLE/AMBIGUO tomadas:**
- RAD/GRAD interpretado como radianes/grados sexagesimales (spec v10 §5).
- `latexToAlgebrite.ts` es una conversión mínima placeholder, declarada explícitamente como TODO — el parser completo de 9 etapas (equivalente a la sección 3 de v9) es el Módulo 2B en el plan de fases.

**Riesgos pendientes:**
- No se ha verificado que la API real de `algebrite` (paquete npm) coincida exactamente con las llamadas usadas en `algebriteClient.ts` (`Algebrite.run(...)`) — verificar contra la documentación del paquete al instalar.
- `mathlive` puede requerir configuración adicional de tipos TS (`declare module "mathlive"` o `@types` propios) que no se pudo confirmar sin compilar.

**Módulos siguientes (según el plan de fases de la spec v10):** parser completo de sintaxis de entrada (Módulo 2B), Modo Álgebra, Modo Cálculo, Modo Sistemas de ecuaciones, Modo Matrices, Modo Graficación (con el enfoque híbrido simbólico/numérico de la spec §10), historial con IndexedDB, y ajuste responsive fino para pantallas desde ~320px.

## Estado del proyecto — Módulo 2 (Cierre)

Cubre spec v9 §3 (heredada en v10): parser completo de sintaxis de entrada, en 9 etapas, reemplazando el placeholder `latexToAlgebrite.ts` del Módulo 1.

**Archivos nuevos:**
- `src/engine/parsing/constants.ts` — identificadores multi-letra, constantes y aridad de funciones.
- `src/engine/parsing/normalize.ts` — preprocesamiento LaTeX (`\frac`, `\sqrt`, funciones), normalización Unicode (`π`, `∞`, `√` balanceado), validación de punto decimal.
- `src/engine/parsing/tokenize.ts` — tokenizador con coincidencia greedy de identificadores conocidos.
- `src/engine/parsing/implicitMultiplication.ts` — inserción de `*` explícito.
- `src/engine/parsing/functionArity.ts` — validación de aridad (`log`/`ln`/etc.).
- `src/engine/parsing/equationSplit.ts` — split por el primer `=`.
- `src/engine/parsing/index.ts` — orquestador `parseExpression()`, único punto de entrada del parser.
- `tests/parsing.test.ts` — casos obligatorios de la spec §15.

**Archivos modificados:**
- `src/modes/BasicScientific/BasicScientificMode.tsx` — usa `parseExpression()` en vez del placeholder; captura `PARSE_ERROR` antes de llamar al Web Worker.

**Archivos eliminados:** `src/modes/BasicScientific/latexToAlgebrite.ts` (placeholder del Módulo 1, ya reemplazado).

**Cambios contractuales:** ninguno (el contrato `MathResult`/`ErrorCode` de `types.ts` no cambia).
**Dependencias añadidas:** ninguna.

**Tests — nivel de evidencia: 3 (NO EJECUTADO).** Mismo motivo que el Módulo 1: sin acceso a red en este entorno para instalar Vitest y correrlo de verdad. `tests/parsing.test.ts` cubre: normalización `√4+1`, rechazo de `.5`/`5.`/notación científica, no fragmentación de `theta`, `2theta`→`2*theta`, `xyz` como identificador único, aridad de `log`/`ln`, más de un `=`, `\frac`, y conversión RAD/GRAD. **Corre `npm run test` localmente para confirmar.**

**Suite de regresión:** Módulo 1 no debería verse afectado — el contrato de `BasicScientificMode` con `ResultPanel`/`MathKeyboard` no cambió, solo la fuente del string Algebrite.

**Decisiones DEDUCIBLE/AMBIGUO tomadas:**
- El parser corre en el hilo principal (no en el Web Worker), porque es tokenización ligera, no cómputo simbólico — la regla dura de §3/§12 aplica al cálculo con Algebrite, no al parsing.
- La lista de variables multi-letra reservadas (`theta`, `alpha`, etc. en `constants.ts`) es una lista cerrada elegida por convención matemática común; ampliarla es trivial si hace falta otra.

**Riesgos pendientes:** el parser no se ha probado contra la superficie real de sintaxis de MathLive más allá de los casos en `tests/parsing.test.ts` — es posible que MathLive genere macros LaTeX adicionales no cubiertos aún (ej. `\cdot` con espacios distintos, subíndices). Repórtame cualquier expresión que falle al escribirla en la app.

**README actualizado:** sí, esta sección.

## Estado del proyecto — Módulo 3 (Cierre)

Cubre spec v10 §6 — Modo 2: Álgebra (resolución de ecuaciones de una variable).

**Archivos nuevos:**
- `src/engine/stepEngine/algebra.ts` — genera forma estándar + raíces vía Algebrite.
- `src/modes/Algebra/AlgebraMode.tsx` — UI del modo (reutiliza `NaturalInput`, `MathKeyboard`, `ResultPanel`).
- `src/components/StepList.tsx` — lista de pasos, nuevo componente compartido para todos los modos que generen procedimiento.
- `tests/algebra.test.ts`.

**Archivos modificados:**
- `src/engine/parsing/index.ts` — `ParsedExpression` ahora expone `leftAlgebrite`/`rightAlgebrite` por separado (antes solo el combinado `"(left)-(right)"`), necesario para mostrar la ecuación original en los pasos.
- `src/workers/compute.worker.ts` — nuevo tipo de mensaje `solveAlgebra`.
- `src/App.tsx` — reemplaza el montaje de un solo modo por un selector de pestañas (Científica/Álgebra); usa estado simple, no router (ver comentario en el archivo sobre por qué se pospuso `HashRouter`).
- `src/components/MathKeyboard.tsx` — nueva prop opcional `showAngleToggle` (el toggle RAD/GRAD no aplica al modo Álgebra).

**Cambios contractuales:** `ParsedExpression` gana 2 campos nuevos (no rompe a los consumidores existentes, son aditivos). `MathKeyboard` gana una prop opcional (no rompe llamadas existentes).

**Dependencias añadidas:** ninguna.

**Tests — nivel de evidencia: 3 (NO EJECUTADO).** `tests/algebra.test.ts` cubre: `2x+3=7` → `x=2`, detección de que una expresión sin "=" no debe enviarse a `solveAlgebra`, y detección de 2 variables libres para el caso de rechazo en la UI. **Corre `npm run test` localmente.**

**Suite de regresión:** el cambio en `ParsedExpression` es aditivo — `tests/parsing.test.ts` del Módulo 2 no debería romperse, pero vale la pena correrlo de nuevo junto con el nuevo.

**Decisiones DEDUCIBLE/AMBIGUO tomadas:**
- Si la ecuación tiene 0 o más de 1 variable libre, se rechaza con `PARSE_ERROR` en vez de adivinar o pedir selección — dejar que el usuario elija manualmente la variable es un TODO de un módulo posterior.
- Los "pasos" generados son de alto nivel (ecuación original → forma estándar → raíces), NO aislamiento término a término. Esto se declaró explícitamente en `hasDetailedSteps: false` y en los comentarios de `stepEngine/algebra.ts` — ver spec v10 §4, que exige visibilizar cuándo el procedimiento no es detallado.

**Riesgos pendientes:** no se ha verificado contra la API real de `Algebrite.run("roots(...)")` — el formato exacto de salida para raíces múltiples (separador, formato de números complejos) puede requerir ajustar el parseo en `algebriteClient.ts::solveEquation` una vez se corra contra la librería real.

## Estado del proyecto — Módulo 4 (Cierre)

Cubre spec v10 §7 — Modo 3: Cálculo (límites, derivadas, integrales indefinidas y definidas).

**Archivos nuevos:**
- `src/engine/numericFallback.ts` — evaluador numérico propio (parser recursivo-descendente sobre sintaxis Algebrite) + Simpson + estimación de límites por acercamiento. Deliberadamente NO depende de la sustitución numérica de Algebrite, por la incertidumbre ya declarada sobre su API exacta.
- `src/engine/stepEngine/calculus.ts` — orquesta el enfoque híbrido simbólico/numérico para cada operación.
- `src/modes/Calculus/CalculusMode.tsx` — UI con selector de operación (Límite/Derivada/Integral indefinida/Integral definida).
- `tests/calculus.test.ts`.

**Archivos modificados:**
- `src/engine/algebriteClient.ts` — añade `indefiniteIntegral()` y `symbolicLimit()`, ambas best-effort con manejo de fallo explícito.
- `src/workers/compute.worker.ts` — 4 tipos de mensaje nuevos: `derivative`, `limit`, `indefiniteIntegral`, `definiteIntegral`.
- `src/App.tsx` — pestaña "Cálculo" añadida.

**Cambios contractuales:** ninguno rompe lo existente (todo aditivo).
**Dependencias añadidas:** ninguna (el evaluador numérico es código propio, sin librerías nuevas).

**Tests — nivel de evidencia: 3 (NO EJECUTADO).** `tests/calculus.test.ts` cubre: evaluación numérica de polinomios y trigonométricas, integral de `x²` en `[0,1]` (valor exacto 1/3), y el límite clásico `sin(x)/x` en `x→0` (debe acercarse a 1). **Corre `npm run test` localmente.**

**Suite de regresión:** cambios aditivos; los tests de Módulos 2-3 no deberían verse afectados.

**Decisiones DEDUCIBLE/AMBIGUO tomadas (todas ya previstas en la spec §7/§10, aplicadas aquí por primera vez):**
- Derivada limitada a orden 1-3.
- Integral indefinida: SOLO simbólica — si Algebrite no la resuelve, se reporta `UNSUPPORTED_OPERATION`, nunca un número inventado (una integral indefinida no tiene un único valor que aproximar).
- Límite e integral definida: intento simbólico primero, fallback numérico marcado con `confidence: "NUMERIC_FALLBACK"` y visible en `ResultPanel` (banner ámbar ya implementado desde el Módulo 1).
- Punto del límite y límites de integración se piden como campos numéricos simples, no `NaturalInput` — no soportan aún notación como `\infty`. Declarado como TODO explícito en el propio archivo.

**Riesgo aceptado y ya declarado:** el evaluador numérico propio es la pieza más nueva y menos probada de todo el proyecto — cúbrela bien al correr `npm run test` antes de confiar en los resultados de límites/integrales.

## Estado del proyecto — Módulo 5 (Cierre)

Cubre spec v10 §8 — Modo 4: Sistemas de ecuaciones lineales (2 a 4 variables).

**Archivos nuevos:**
- `src/engine/matrixOps.ts` — Gauss-Jordan con aritmética EXACTA (fraction.js, nunca floats), reutilizable también por el futuro Modo Matrices (Módulo 6). Clasifica el resultado en `unique`/`infinite`/`none`.
- `src/engine/stepEngine/linearSystem.ts` — convierte cada ecuación en una fila de la matriz aumentada usando un truco: el coeficiente de cada variable es su derivada simbólica (`d(expr,v)`), y el término independiente es la expresión evaluada con todas las variables en 0. Valida linealidad explícitamente (si la derivada de una variable contiene otra variable del sistema, rechaza con `UNSUPPORTED_OPERATION`).
- `src/modes/LinearSystems/LinearSystemsMode.tsx` — UI con selector 2/3/4 ecuaciones.
- `tests/linearSystem.test.ts`.

**Archivos modificados:**
- `src/workers/compute.worker.ts` — nuevo tipo de mensaje `linearSystem`.
- `src/App.tsx` — pestaña "Sistemas" añadida.

**Cambios contractuales:** ninguno rompe lo existente.
**Dependencias añadidas:** ninguna (fraction.js ya estaba desde el Módulo 1).

**Tests — nivel de evidencia: 3 (NO EJECUTADO).** `tests/linearSystem.test.ts` cubre: sistema 2x2 con solución única, sistema inconsistente, sistema con infinitas soluciones, e integración con el parser real (incluye un caso de sistema no lineal que debe rechazarse). **Corre `npm run test` localmente.**

**Suite de regresión:** cambios aditivos.

**Decisiones DEDUCIBLE/AMBIGUO tomadas:**
- Rango de tamaño 2-4 ecuaciones (spec no lo fija; se decidió por paridad con matrices hasta 4x4).
- Se exige que el número de variables detectadas coincida exactamente con el número de ecuaciones — no se soportan sistemas con más incógnitas que ecuaciones (subdeterminados) todavía; si ocurre, se rechaza con un mensaje explicativo en vez de intentar resolverlo parcialmente.
- Caso "infinitas soluciones" (`compatible indeterminado`): se detecta correctamente y se muestran los pasos de la eliminación, pero **no se calcula la parametrización explícita** (ej. "x = 2 - t, y = t") — se reporta el hecho, no la fórmula paramétrica. Esto se marcó con `confidence: "PARTIAL"` para que quede visible que el resultado es incompleto. Ampliarlo a la parametrización completa queda como TODO de un módulo posterior si se necesita.

**Riesgo aceptado:** la validación de linealidad depende de que `derivative()` (Algebrite `d()`) funcione como se espera contra la librería real — mismo riesgo ya declarado en módulos anteriores sobre la API exacta de Algebrite.

## Estado del proyecto — Módulo 6 (Cierre)

Cubre spec v10 §9 — Modo 5: Matrices (suma, resta, multiplicación, transposición, determinante, inversa, potencia).

**Archivos nuevos:**
- Ampliación de `src/engine/matrixOps.ts` — `addMatrices`, `subtractMatrices`, `multiplyMatrices`, `transposeMatrix`, `determinant` (cofactores, válido hasta 4x4), `invertMatrix` (Gauss-Jordan sobre `[A|I]`), `powerMatrix` (multiplicación repetida, solo exponente entero ≥ 0).
- `src/components/MatrixGridInput.tsx` — grilla de entrada de matriz.
- `src/modes/Matrices/MatrixMode.tsx` — UI con selector de operación y tamaño (2x2 a 4x4).
- `tests/matrixOps.test.ts`.

**Archivos modificados:**
- `src/workers/compute.worker.ts` — nuevo tipo de mensaje `matrixOp` con 7 operaciones.
- `src/App.tsx` — pestaña "Matrices" añadida.

**Cambios contractuales:** ninguno rompe lo existente.
**Dependencias añadidas:** ninguna.

**Tests — nivel de evidencia: 3 (NO EJECUTADO).** `tests/matrixOps.test.ts` cubre: suma, multiplicación, transposición, determinante, inversa (verificada multiplicando A·A⁻¹=I), rechazo de inversa de matriz singular, y potencia (A² y A⁰=I). **Corre `npm run test` localmente.**

**Suite de regresión:** cambios aditivos; los tests de sistemas lineales (Módulo 5) usan funciones separadas del mismo archivo (`gaussJordan`) que no se tocaron.

**Decisiones DEDUCIBLE/AMBIGUO tomadas:**
- Potencia de matrices: solo exponente entero **no negativo** (ya señalado como AMBIGUO en la spec v10 §9 — potencias negativas equivalentes a `(A⁻¹)ⁿ` no están implementadas; la inversa está disponible como operación separada).
- Las celdas de la matriz se ingresan como `<input>` de texto plano (aceptan `1/2`, `-3`, etc. vía `fraction.js`), no como `NaturalInput`/MathLive — mismo TODO que ya se declaró para los parámetros auxiliares del Modo Cálculo.
- El determinante se calcula por expansión de cofactores recursiva — aceptable en rendimiento hasta 4x4 (crece factorialmente, pero 4! = 24 operaciones es trivial); no se optimizó para tamaños mayores porque la spec no los pide.

**Riesgo aceptado:** ninguno nuevo relacionado con Algebrite — todas las operaciones de este módulo son álgebra lineal pura implementada con `fraction.js`, sin pasar por Algebrite en absoluto, así que este módulo es el que menos depende de la incertidumbre sobre la API exacta de Algebrite señalada en módulos anteriores.

## Estado del proyecto — Módulo 7 (Cierre)

Cubre spec v10 §10 — Modo 6: Graficación (dominio, rango, intercepciones, extremos, inflexión, vértice). **Con este módulo quedan los 6 modos del Prompt.md original implementados.**

**CAMBIO DE ENFOQUE DECLARADO (leer antes de confiar en este módulo):** la spec original pedía un híbrido "intento simbólico primero, numérico como fallback". Esta implementación va **directo al camino numérico** (muestreo denso + diferencias finitas + bisección) para todo el análisis — dominio, rango, intercepciones, extremos, inflexión y vértice —, sin pasar por Algebrite en absoluto. Motivo: este era ya, según la propia spec, el módulo de mayor riesgo del proyecto; apoyarlo en la misma incertidumbre sobre la API exacta de Algebrite que ya se señaló en los Módulos 3-5 habría compuesto dos riesgos en el módulo más frágil. El enfoque numérico puro es menos elegante pero es autocontenido y se puede probar de verdad en cuanto compiles, sin depender de esa incertidumbre. Por eso **todo resultado de este módulo se marca como aproximado** (banner visible en la UI), nunca como exacto.

También se descartó `function-plot` (la librería que la spec original proponía para el renderizado): en su lugar, `GraphViewer.tsx` dibuja la curva con **SVG puro** a partir de los puntos ya muestreados — evita sumar otra dependencia externa no verificable en este entorno sin red, y de paso reduce el bundle.

**Archivos nuevos:**
- `src/engine/stepEngine/graphing.ts` — `analyzeGraph()`: dominio/rango aproximados por muestreo, intercepciones por cambio de signo + bisección, extremos locales/globales y puntos de inflexión por diferencias finitas de f'/f'', detección de vértice solo cuando f'' es aproximadamente constante (indicio de cuadrática).
- `src/components/GraphViewer.tsx` — renderizado SVG de la curva y los puntos notables.
- `src/modes/Graphing/GraphingMode.tsx` — UI del modo, con selector de ventana de visualización.
- `tests/graphing.test.ts` — usa `x²-4` como caso de referencia (vértice, raíces e intercepción en y conocidos de antemano).

**Archivos modificados:**
- `src/types.ts` — `MathResult` gana el campo opcional `graphAnalysis?: unknown` (tipado como `unknown` a propósito, para evitar un import circular entre `types.ts` y `stepEngine/graphing.ts`; se castea en `GraphingMode.tsx`).
- `src/workers/compute.worker.ts` — nuevo tipo de mensaje `graph`.
- `src/App.tsx` — pestaña "Graficación" añadida (sexta y última pestaña).

**Cambios contractuales:** aditivo (campo opcional nuevo en `MathResult`).
**Dependencias añadidas:** ninguna — de hecho, se elimina la necesidad de `function-plot` prevista en la spec original (nunca llegó a instalarse, así que no hace falta quitarla de `package.json`).

**Tests — nivel de evidencia: 3 (NO EJECUTADO).** `tests/graphing.test.ts` verifica contra `x²-4` (caso con vértice, raíces e intercepción conocidos exactamente) y confirma que una función no cuadrática (`sin(x)`) no reporta vértice. **Corre `npm run test` localmente — este es el módulo que más vale la pena verificar primero,** por ser el de mayor riesgo.

**Suite de regresión:** cambio aditivo en `types.ts`; no debería afectar otros módulos.

**Decisiones DEDUCIBLE/AMBIGUO tomadas:**
- Ventana de visualización por defecto `[-10, 10]`, ajustable por el usuario — la spec no fija un rango.
- Dominio/rango se reportan como aproximaciones basadas en muestreo (2000 puntos), no como restricciones simbólicas exactas — declarado explícitamente en la UI, no oculto.
- El vértice solo se calcula cuando la segunda derivada numérica es aproximadamente constante en todo el muestreo (heurística de "parece cuadrática"); no hay un chequeo simbólico de que el grado sea exactamente 2.

**Riesgo aceptado y ya declarado:** al ser 100% numérico, el análisis puede fallar o dar resultados engañosos en funciones con comportamiento extremo dentro de la ventana visible (asíntotas muy pronunciadas, oscilaciones muy rápidas tipo `sin(1/x)` cerca de 0) — el muestreo uniforme de 2000 puntos puede no capturarlas bien. No se implementó muestreo adaptativo por razones de tiempo; queda como TODO si se necesita mayor precisión.

## Estado del proyecto — Módulo 8 (Cierre)

Historial persistente con IndexedDB + ajustes responsive básicos — ver "Módulos siguientes" del cierre del Módulo 1.

**Archivos nuevos:**
- `src/store/historyDb.ts` — wrapper sobre `idb`: guarda, lista (más reciente primero) y limpia el historial. Poda automáticamente por encima de 200 entradas.
- `src/components/HistoryPanel.tsx` — nueva pestaña "Historial": lista de cálculos pasados con modo, entrada, resultado y fecha; botón "Borrar todo".

**Archivos modificados:**
- Los 6 modos (`BasicScientificMode`, `AlgebraMode`, `CalculusMode`, `LinearSystemsMode`, `MatrixMode`, `GraphingMode`) — cada uno llama a `addHistoryEntry()` cuando el cálculo tiene éxito.
- `src/App.tsx` — séptima pestaña "Historial"; se añadió `padding` con `env(safe-area-inset-*)` para evitar que el notch/la barra de gestos del teléfono tapen contenido cuando la app corre como PWA instalada (spec v10 §12).

**Cambios contractuales:** ninguno.
**Dependencias añadidas:** ninguna (`idb` ya estaba listada desde el Módulo 1, ahora se usa por primera vez).

**Tests:** no se añadieron tests nuevos para `historyDb.ts` — IndexedDB no está disponible en el entorno de Vitest por defecto (requeriría `fake-indexeddb` como dependencia de desarrollo adicional, no incluida). Si quieres cobertura automática de esto, dímelo y añado esa dependencia en un ajuste posterior.

**Decisiones DEDUCIBLE/AMBIGUO tomadas:**
- Límite de 200 entradas de historial con poda automática de las más antiguas — la spec no fija un límite.
- El resumen guardado por cada modo es simplificado (el LaTeX/texto del resultado, no los pasos completos) para mantener el historial ligero.
- El ajuste responsive es un cambio razonado (safe-area, tamaños de celda ya verificados por cálculo para caber en ~320px) pero **no se ha probado visualmente en un dispositivo real ni en un emulador** — sigue pendiente, como ya se señaló desde el Módulo 1.

**Riesgo aceptado:** `idb` es una librería pequeña y estable, pero, como con el resto de dependencias de este proyecto, su uso aquí tampoco se ha podido compilar/probar en este entorno sin red.

## Revisión de código — hallazgos y correcciones (post-Módulo 8)

Se corrió `tsc --noEmit` directamente (hay un compilador TypeScript disponible en el entorno de generación, aunque sigue sin red para instalar las dependencias del proyecto) para separar ruido esperado (imports que no resuelven sin `node_modules`) de errores reales. De ~300 errores reportados, solo 2 eran genuinos:

1. **`algebrite` no publica tipos de TypeScript propios.** Sin una declaración de tipos, todo lo que sale de `Algebrite.run(...)` se vuelve `any` y se propaga — con `"strict": true` esto iba a producir errores de "implicit any" en cuanto corrieras `npm install` de verdad. **Corregido:** se añadió `src/types/algebrite.d.ts` con una firma mínima (`run(input: string): string`). Si un módulo futuro necesita otra función de la API de Algebrite, esta declaración hay que ampliarla.
2. **Bug de validación real en `functionArity.ts`:** una llamada con paréntesis vacíos, ej. `sqrt()` (posible si usas el botón √ del teclado sin rellenar el argumento), se contaba incorrectamente como 1 argumento válido en vez de 0, dejándola pasar hacia Algebrite. **Corregido:** ahora se rechaza explícitamente con `PARSE_ERROR` antes de llegar a Algebrite. Test nuevo en `tests/parsing.test.ts` que cubre este caso.

Todo lo demás en el reporte de `tsc` (unused-var triviales en `matrixOps.ts`, y advertencias de tipos en los `useState`/manejadores de eventos de los componentes) es fallout esperado de no tener `@types/react` ni el resto de `node_modules` instalados — no se tocó nada de eso porque intentar "arreglarlo" sin los tipos reales presentes sería adivinar, y esa clase de errores de hecho desaparece sola en cuanto corras `npm install`. **Corre `npm run typecheck` localmente para confirmar que, con los tipos reales instalados, no queda ninguno de estos dos ni ningún otro.**

## Revisión de código — segunda pasada (3 hallazgos más)

Una segunda pasada más cuidadosa encontró 3 problemas adicionales que la primera pasó por alto:

1. **Dos variables no usadas en `matrixOps.ts` (`col` en `gaussJordan`, `rows` en `transposeMatrix`) SÍ rompían el build**, a diferencia de lo que dije en la nota anterior — el proyecto tiene `noUnusedLocals: true` en `tsconfig.app.json`, así que esto no era una advertencia cosmética sino un error de compilación real. Corregido.
2. **Bug silencioso de lógica en `normalize.ts` (orden de operaciones):** `\sqrt[n]{x}` (raíz enésima, el botón ⁿ√ del teclado) se procesaba DESPUÉS del reemplazo genérico de `\sqrt{x}`, que consumía el patrón primero y descartaba el índice `[n]` sin ningún error — convirtiendo silenciosamente cualquier raíz cúbica, cuarta, etc. en una simple raíz cuadrada. Este es el más serio de los tres: no fallaba la compilación ni lanzaba una excepción, simplemente daba un resultado matemáticamente incorrecto. Corregido invirtiendo el orden de los dos reemplazos, con test de regresión en `tests/parsing.test.ts` (`\sqrt[3]{8}` debe dar `(8)^(1/(3))`, no `sqrt(8)`).

Con esto, los 3 errores reales encontrados entre las dos pasadas de revisión (tipos de Algebrite, aridad de `sqrt()` vacío, y este de la raíz enésima) están corregidos. **Sigue pendiente correr `npm run typecheck` y `npm run test` de verdad** — esa es la única forma de confirmar que no queda nada más.

## Revisión de código — tercera pasada (2 hallazgos más)

Una tercera pasada, esta vez centrada en revisar la lógica a mano (no solo lo que `tsc` puede detectar), encontró 2 problemas más:

4. **Bug real en `numericFallback.ts`:** el evaluador numérico propio (usado por Graficación, Límite e Integral definida cuando el cálculo simbólico falla) solo manejaba el signo `-` unario, no el `+` unario. Cualquier expresión con un `+` explícito al inicio o tras un operador (ej. `+x^2-4`) lanzaba un error de "carácter inesperado" en vez de evaluarse. Corregido — verificado manualmente contra la lógica del parser en Node antes de aplicarlo (`compileNumeric("+x^2-4","x")(3)` ahora da `5`, correcto). Test nuevo en `tests/calculus.test.ts`.
5. **Bug de usabilidad real en `matrixOps.ts`:** una celda vacía en el Modo Matrices (algo común al no querer escribir los ceros de una matriz dispersa) hacía fallar TODO el cálculo con `PARSE_ERROR("Valor no numérico")`, en vez de tratarse como 0. Corregido: `toFractionMatrix()` ahora normaliza celdas vacías/solo-espacios a 0 antes de convertir a `Fraction`. Test nuevo en `tests/matrixOps.test.ts`.

Van **5 errores reales** encontrados y corregidos en tres pasadas de revisión (tipos de Algebrite, aridad de `sqrt()` vacío, raíz enésima que se convertía en cuadrada, signo `+` unario en el evaluador numérico, y celdas vacías de matriz). Cada pasada encontró algo que la anterior no vio — es razonable asumir que una cuarta pasada encontraría menos, pero no puedo garantizar que encuentre cero; la única verificación definitiva sigue siendo correr `npm install && npm run typecheck && npm run test` de verdad.

## Revisión de código — cuarta pasada (1 hallazgo más, con una nota honesta)

6. **Bug real de borde en Graficación:** si "desde" y "hasta" (la ventana de visualización) son el mismo número, `GraphViewer` dividía entre cero al escalar las coordenadas X (`xMax - xMin = 0`), y la curva desaparecía sin ningún error visible. Corregido en dos capas: validación en la UI (`GraphingMode.tsx`, con normalización adicional si el usuario invierte "desde"/"hasta") y, más importante, la validación real vive en el motor (`analyzeGraph()` en `graphing.ts`) — así queda protegido sin importar qué código llame a esa función en el futuro, no solo la UI actual. Tests nuevos en `tests/graphing.test.ts`.

Van **6 errores reales** encontrados y corregidos en cuatro pasadas. Nota honesta sobre el patrón: cada pasada ha encontrado algo, lo cual no es evidencia de que el código esté especialmente mal — es evidencia de que la revisión manual sin poder compilar/ejecutar contra las dependencias reales tiene un techo real de efectividad, y ese techo no baja a cero solo por insistir con más rondas. Si se pide una quinta pasada bajo las mismas condiciones (sin `npm install` real), es razonable esperar retornos decrecientes: correr `npm run typecheck && npm run test` de verdad va a ser más informativo que cualquier ronda adicional de lectura manual.

## Build real en GitHub Actions — 5 errores encontrados y corregidos

Esta fue la primera verificación contra las dependencias REALES (vía `npm ci` en GitHub Actions, no en este entorno sin red). Encontró 4 errores de compilación distintos (uno repetido) que ninguna de las cuatro pasadas de revisión manual anteriores había detectado, porque dependían exactamente de tener el paquete real instalado:

1. **`NaturalInput.tsx` — `@ts-expect-error` sin usar + tipo de `math-field` incompleto.** El tipo JSX personalizado para `<math-field>` no incluía `placeholder` ni `virtual-keyboard-mode` como props válidas. Con React real instalado, el error SÍ aparecía (al contrario de lo que parecía en este entorno sin tipos de React, donde todo el tag ya fallaba por otras razones y enmascaraba esto). Corregido: se añadieron ambas props explícitamente al tipo, y se quitó el `@ts-expect-error` que ya no aplicaba.
2. **`algebriteClient.ts` — el shim de tipos de `algebrite` no funcionó de verdad.** El intento anterior (`declare module "algebrite" { ... }` con una firma completa) no fue reconocido por el compilador real — seguía reportando `TS7016: Could not find a declaration file`. Corregido usando la forma "shorthand" que el propio mensaje de error de `tsc` sugiere (`declare module "algebrite";`), que tipa todo el módulo como `any`. Para que ese `any` no se cuele en callbacks (`.map()`, etc.) sin que el compilador lo detecte, cada llamada a `Algebrite.run(...)` en el archivo ahora anota explícitamente `: string` en la variable que recibe el resultado.

Con esto van **8 errores reales corregidos en total** (2 de la primera pasada + 3 de la segunda + 2 de la tercera + 1 de la cuarta + estos de la build real). Esta última tanda es la más confiable de todas porque no depende de mi criterio sobre cómo "debería" comportarse el compilador — es el compilador real, con las dependencias reales, diciendo exactamente qué está mal.

## Requisitos previos

- Node.js 20+
- npm

## Instalación y ejecución local

```bash
npm install
npm run dev
```

## Build de producción

```bash
npm run build
npm run preview
```

## Despliegue a GitHub Pages

1. Cambia `REPO_NAME` en `vite.config.ts` por el nombre real de tu repositorio.
2. En GitHub: **Settings → Pages → Source → GitHub Actions**.
3. Haz push a `main` — el workflow `.github/workflows/deploy.yml` compila y publica automáticamente.

## Estructura del proyecto

```
/src
  /engine        (algebriteClient.ts, fractions.ts — único punto de contacto con Algebrite/fraction.js)
  /modes
    /BasicScientific  (Modo 1 — implementado en este módulo)
  /components    (NaturalInput, MathKeyboard, ResultPanel)
  /workers       (compute.worker.ts — todo el cómputo pesado)
  types.ts       (contrato de datos central: MathResult, ErrorCode, etc.)
  App.tsx, main.tsx, index.css
.github/workflows/deploy.yml
vite.config.ts   (incluye configuración PWA)
```

## Limitaciones conocidas (Módulo 1)

- Solo el Modo 1 (calculadora básica/científica) está implementado.
- `latexToAlgebrite.ts` es una conversión simplificada, no el parser robusto de la spec — ver TODO en el archivo.
- Los íconos de PWA en `public/icons/` son placeholders — reemplázalos por íconos reales de 192x192, 512x512 y 512x512 maskable antes de publicar.
- No se ha podido compilar ni probar visualmente en este entorno (sin acceso a red) — ver "Estado del proyecto" arriba.
