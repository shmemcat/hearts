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
        background: "var(--background)",
        contentbox: "var(--contentbox)",
        header: "var(--header)",
        text: "var(--text)",
        warningicon: "var(--warningicon)",
        heartslogo: "var(--heartslogo)",
        mediumpink: "var(--mediumpink)",
        inputboxborder: "var(--inputboxborder)",
        buttonboxshadow: "var(--buttonboxshadow)",
      },
    },
  },
  plugins: [],
};

export default config;
