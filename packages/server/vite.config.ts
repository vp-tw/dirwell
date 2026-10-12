import { defineConfig } from "vite-plus";
export default defineConfig({
  pack: {
    entry: ["src/index.ts", "src/node.ts", "src/express.ts", "src/fastify.ts"],
    format: ["esm"],
    platform: "node",
    target: "node22.12",
    dts: true,
    sourcemap: true,
    clean: true,
  },
});
