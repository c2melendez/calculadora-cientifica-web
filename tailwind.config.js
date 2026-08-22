/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0f172a",
        panel: "#111827",
        keypad: "#1f2937",
        accent: "#2563eb",
        accentSoft: "#1d4ed8",
      },
    },
  },
  plugins: [],
};
