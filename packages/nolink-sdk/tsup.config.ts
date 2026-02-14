import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts", "src/react.tsx", "src/vue.ts"],
    format: ["cjs", "esm"],
    dts: true,
    minify: true,
  },
  {
    entry: ["src/index.ts"],
    format: ["iife"],
    globalName: "Nolink",
    outExtension: () => ({ js: ".global.js" }),
    minify: true,
  },
]);
