import { defineConfig } from "vite-plus";
export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/dev.ts"],
    format: ["esm"],
    platform: "node",
    target: "node22.12",
    dts: true,
    sourcemap: true,
    deps: {
      dts: {
        neverBundle: [
          "@dirwell/core",
          "@dirwell/server",
          "@dirwell/theme-ledger",
          "@dirwell/theme-crosswave",
          "vite",
        ],
      },
    },
  },
});
