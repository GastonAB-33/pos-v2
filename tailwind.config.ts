import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"DM Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        brand: {
          50: "#f2efff",
          100: "#e6dfff",
          500: "#7c6af7",
          600: "#6958e8",
          700: "#5848d2",
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
