import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["site/**", ".impeccable/**"],
  },
  pack: {
    deps: { resolveDepSubpath: true, dts: { neverBundle: ["vite", "unplugin"] } },
    clean: true,
    copy: {
      from: "src/theme-runtime.js",
      rename: "theme-runtime.js",
      to: "dist",
    },
    dts: true,
    entry: [
      "src/index.ts",
      "src/bin.ts",
      "src/theme-components.ts",
      "src/vite.ts",
      "src/unplugin.ts",
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
    sourcemap: true,
  },
});
