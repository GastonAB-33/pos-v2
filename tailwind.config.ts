import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Hanken Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9ebff",
          500: "#0874d1",
          600: "#0056b3",
          700: "#00458f",
        },
      },
      borderRadius: {
        panel: "14px",
      },
      boxShadow: {
        panel: "0 22px 48px rgba(8, 8, 12, 0.42)",
      },
    },
  },
  plugins: [],
} satisfies Config;
