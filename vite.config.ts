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
    entry: ["src/index.ts", "src/bin.ts", "src/theme-components.ts", "src/vite.ts"],
    format: ["esm"],
    platform: "node",
    sourcemap: true,
  },
});
