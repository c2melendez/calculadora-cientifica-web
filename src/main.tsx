import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// BUG real (reportado por el usuario con captura: "8÷9" mostraba "98" en
// vez de una fracción con barra). convertLatexToMarkup() (ResultPanel,
// HistoryLog) genera HTML plano que necesita este stylesheet para
// renderizar fracciones/raíces/potencias correctamente — a diferencia del
// <math-field> de entrada, que se ve bien SIN esto porque encapsula sus
// propios estilos en Shadow DOM. Sin este import, MathLive apila
// numerador/denominador en su orden interno (denominador antes que
// numerador, truco de alineación vertical) sin la barra de fracción, lo
// que se lee como los dígitos concatenados y en orden invertido.
import "mathlive/static.css";
import "mathlive/fonts.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
