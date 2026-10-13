import { defineConfig } from "vite-plus";
export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/model.ts"],
    format: ["esm"],
    platform: "node",
    target: "node22.12",
    dts: true,
    sourcemap: true,
    clean: false,
    deps: { dts: { neverBundle: ["@dirwell/core"] } },
  },
});
