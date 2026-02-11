import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        bloom: {
          "0%": { transform: "scale(0.2)", opacity: "0" },
          "60%": { transform: "scale(1.1)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        "bridge-glow": {
          "0%, 100%": { boxShadow: "0 0 12px rgba(138, 154, 91, 0.25)" },
          "50%": { boxShadow: "0 0 20px rgba(138, 154, 91, 0.4)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.2s ease-out",
        bloom: "bloom 0.6s ease-out forwards",
        "soft-pulse": "soft-pulse 2s ease-in-out infinite",
        "bridge-glow": "bridge-glow 2.5s ease-in-out infinite",
      },
      colors: {
        dear: {
          bg: "#FDFCF8",
          "bg-paper": "#FAF9F5",
          charcoal: "#333333",
          "charcoal-soft": "#5C5C5C",
          sage: "#8A9A5B",
          "sage-soft": "#A8B87D",
          terracotta: "#E2725B",
          "terracotta-soft": "#E89A8A",
        },
        dojo: {
          white: "#FFFFFF",
          purple: "#5B4B8A",
          "purple-light": "#7B6BA8",
          "purple-dark": "#4A3D6F",
          "purple-muted": "#E8E4F2",
          ink: "#2D2A36",
          "ink-soft": "#5C5868",
        },
        sanctuary: {
          cream: "#FDF8F3",
          blush: "#F5E6E0",
          sage: "#D4E5D9",
          lavender: "#E8E0F0",
          peach: "#F0D9D0",
          mint: "#D8EDE4",
          sky: "#E0EDF5",
          sand: "#F5EFE7",
          text: "#5C5348",
          "text-soft": "#8A8176",
          accent: "#C4A77D",
          flower: "#E8B4B8",
        },
      },
      fontFamily: {
        sans: ["system-ui", "Apple SD Gothic Neo", "Malgun Gothic", "sans-serif"],
        serif: ["var(--font-serif-kr)", "Georgia", "Batang", "serif"],
      },
      boxShadow: {
        paper: "0 1px 3px rgba(51,51,51,0.06), 0 1px 2px rgba(51,51,51,0.04)",
        "paper-lg": "0 4px 12px rgba(51,51,51,0.06), 0 2px 4px rgba(51,51,51,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
