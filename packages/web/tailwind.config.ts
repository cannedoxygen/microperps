import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        short: {
          DEFAULT: "#ef4444",
          dark: "#dc2626",
          light: "#f87171",
        },
        long: {
          DEFAULT: "#22c55e",
          dark: "#16a34a",
          light: "#4ade80",
        },
        background: "#0a0a0a",
        foreground: "#fafafa",
        card: "#171717",
        border: "#262626",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow-short": "glow-short 2s ease-in-out infinite alternate",
        "glow-long": "glow-long 2s ease-in-out infinite alternate",
      },
      keyframes: {
        "glow-short": {
          "0%": { boxShadow: "0 0 20px rgba(239, 68, 68, 0.3)" },
          "100%": { boxShadow: "0 0 40px rgba(239, 68, 68, 0.6)" },
        },
        "glow-long": {
          "0%": { boxShadow: "0 0 20px rgba(34, 197, 94, 0.3)" },
          "100%": { boxShadow: "0 0 40px rgba(34, 197, 94, 0.6)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
