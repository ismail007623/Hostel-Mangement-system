import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        pine: {
          50: "#eef6f1",
          100: "#d7e9dd",
          600: "#14532d",
          700: "#0b3d2e",
          800: "#082e23",
          900: "#052419",
        },
        gold: {
          400: "#d4a017",
          500: "#c9a227",
          600: "#a9861d",
        },
        cream: "#faf7f0",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        urdu: ["'Noto Nastaliq Urdu'", "'Noto Naskh Arabic'", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
