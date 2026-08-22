import { BasicScientificMode } from "./modes/BasicScientific/BasicScientificMode";

// Módulo 1: solo el Modo 1 (calculadora básica/científica) está montado.
// Los modos Álgebra, Cálculo, Sistemas, Matrices y Graficación se añaden en
// los módulos siguientes del plan de fases (ver plantilla de módulos v10).
// La navegación entre modos (tabs/HashRouter) también llega en ese punto.

export default function App() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-slate-800 p-4 text-center text-lg font-semibold text-slate-100">
        Calculadora Científica
      </header>
      <BasicScientificMode />
    </div>
  );
}
