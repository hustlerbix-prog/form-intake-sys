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
        navy: {
          DEFAULT: "#0D1B2A",
          800: "#1E2D3D",
          600: "#2D4460",
        },
        teal: {
          DEFAULT: "#0EA5A0",
          light: "#5EEAD4",
        },
        slateText: {
          DEFAULT: "#CBD5E1",
        },
      },
      fontFamily: {
        syne: ["var(--font-syne)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-dm-sans)", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};
export default config;
