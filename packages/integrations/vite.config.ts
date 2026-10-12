import { defineConfig } from "vite-plus";
export default defineConfig({
  pack: {
    deps: { resolveDepSubpath: true, dts: { neverBundle: ["vite", "unplugin"] } },
    entry: [
      "src/unplugin.ts",
      "src/vite.ts",
      "src/rollup.ts",
      "src/rolldown.ts",
      "src/webpack.ts",
      "src/rspack.ts",
      "src/rsbuild.ts",
      "src/esbuild.ts",
      "src/farm.ts",
      "src/bun.ts",
    ],
    format: ["esm"],
    platform: "node",
    target: "node22.12",
    dts: true,
    sourcemap: true,
    clean: true,
  },
});
