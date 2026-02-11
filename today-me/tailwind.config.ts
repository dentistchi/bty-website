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
        serif: ["Georgia", "serif"],
      },
      animation: {
        "bloom": "bloom 0.6s ease-out forwards",
        "soft-pulse": "soft-pulse 2s ease-in-out infinite",
      },
      keyframes: {
        bloom: {
          "0%": { transform: "scale(0.2)", opacity: "0" },
          "60%": { transform: "scale(1.1)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
