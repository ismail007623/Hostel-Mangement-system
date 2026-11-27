import type { Config } from "tailwindcss";

/**
 * Design tokens — Taqwa frontend redesign (foundation).
 * Primary #103D30, active bg #E8F2EC, page bg #F7F8FA, card #FFFFFF,
 * borders #E2E8E5, primary text #172B25, secondary text #64748B,
 * success #28805A, warning #B78119, danger #DC2626.
 * `pine` is kept as an alias of the new primary scale so existing
 * `pine-*` classes keep working until page agents move to `brand-*`.
 * There is no gold / cream token any more — do not reintroduce them.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#103D30",
          50: "#E8F2EC",
          100: "#D5E6DC",
          200: "#A9CBB8",
          600: "#1A5C46",
          700: "#103D30",
          800: "#0C2E24",
          900: "#08231B",
        },
        pine: {
          50: "#E8F2EC",
          100: "#D5E6DC",
          200: "#A9CBB8",
          600: "#1A5C46",
          700: "#103D30",
          800: "#0C2E24",
          900: "#08231B",
        },
        page: "#F7F8FA",
        active: "#E8F2EC",
        line: "#E2E8E5",
        ink: "#172B25",
        muted: "#64748B",
        success: "#28805A",
        warning: "#B78119",
        danger: "#DC2626",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        urdu: ["'Noto Nastaliq Urdu'", "'Noto Naskh Arabic'", "serif"],
      },
      borderRadius: {
        btn: "8px",
        card: "12px",
        modal: "16px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(23, 43, 37, 0.05)",
        modal: "0 8px 24px rgba(23, 43, 37, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
