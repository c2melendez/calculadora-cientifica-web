import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// IMPORTANTE: cambia "calculadora-cientifica-web" por el nombre real de tu
// repositorio de GitHub antes de desplegar, o los assets no cargarán bajo
// https://<usuario>.github.io/<repo>/
const REPO_NAME = "calculadora-cientifica-web";

export default defineConfig({
  base: `/${REPO_NAME}/`,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Calculadora Científica",
        short_name: "Calculadora",
        description:
          "Calculadora científica, álgebra, cálculo, matrices y graficación — 100% en el navegador.",
        theme_color: "#1d4ed8",
        background_color: "#0f172a",
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
