import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// IMPORTANTE: cambia "precision-lab-lite" por el nombre real de tu
// repositorio de GitHub antes de desplegar, o los assets no cargarán bajo
// https://<usuario>.github.io/<repo>/
const REPO_NAME = "precision-lab-lite";

export default defineConfig({
  base: `/${REPO_NAME}/`,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Precision Lab Lite",
        short_name: "Precision Lab",
        description:
          "Calculadora científica, álgebra, cálculo, matrices y graficación — 100% en el navegador.",
        theme_color: "#14171C",
        background_color: "#14171C",
        display: "standalone",
        start_url: `/${REPO_NAME}/`,
        scope: `/${REPO_NAME}/`,
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      },
    }),
  ],
});
