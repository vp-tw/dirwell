import { defineConfig } from "vite-plus";
export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/client.ts", "src/format.ts"],
    format: ["esm"],
    platform: "node",
    target: "node22.12",
    dts: true,
    sourcemap: true,
    clean: true,
  },
});
