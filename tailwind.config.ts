import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        dyslexic: ["OpenDyslexic", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
