import type { Config } from "tailwindcss";
import fluid, { extract, screens, fontSize } from "fluid-tailwind";

export default {
  content: {
    files: [
      "./src/**/*.pug",
      "./src/**/*.ts",
      "./src/**/*.js",
      "./src/**/*.css",
      "./src/**/*.scss",
      "./src/**/*.sass",
    ],
    extract,
  },
  theme: {
    screens,
    fontSize,
    extend: {},
  },
  plugins: [fluid],
} satisfies Config;
