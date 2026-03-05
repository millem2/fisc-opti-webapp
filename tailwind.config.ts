import type { Config } from "tailwindcss";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { heroui } = require("@heroui/theme");

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              50: "#eef6f1",
              100: "#cce5d7",
              200: "#99ccb0",
              300: "#66b288",
              400: "#3aaa5c",
              500: "#2d8a49",
              600: "#236b39",
              700: "#1B3D2C",
              800: "#122a1e",
              900: "#091710",
              DEFAULT: "#1B3D2C",
              foreground: "#ffffff",
            },
            focus: "#1B3D2C",
          },
        },
      },
    }),
  ],
};

export default config;
