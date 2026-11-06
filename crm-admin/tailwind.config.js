/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          turquoise: "#00B5C8",
          lime: "#7CE01E",
          orange: "#FF7800",
        },
      },
    },
  },
  plugins: [],
};
