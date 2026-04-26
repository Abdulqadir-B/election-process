import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#1E3A8A", // blue-900 (Navy)
          foreground: "#ffffff",
        },
        background: "#F8FAFC", // slate-50 (Off-White)
        foreground: "#0F172A", // slate-900 (Charcoal)
        accent: {
          DEFAULT: "#E11D48", // rose-600 (Crimson)
          foreground: "#ffffff",
        },
        surface: {
          DEFAULT: "#ffffff",
          foreground: "#0F172A",
        }
      },
    },
  },
  plugins: [],
};
export default config;
