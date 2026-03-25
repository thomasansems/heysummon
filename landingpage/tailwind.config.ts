import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          coral: "#FF6B4A",
          blue: "#4A8FE7",
          navy: "#1B2A4A",
          cream: "#F5F0E8",
          dark: "#0A0A14",
          gold: "#FFD166",
          red: "#C1121F",
          brown: "#2A1F14",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
        serif: ["Noto Serif JP", "Georgia", "serif"],
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #FF6B4A 0%, #4A8FE7 100%)",
        "gradient-dark": "linear-gradient(180deg, #0A0A14 0%, #111827 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
