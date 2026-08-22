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
