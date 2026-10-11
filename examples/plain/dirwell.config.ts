import { createPlainTheme, defineConfig } from "../../src/index.ts";

export default defineConfig({
  root: "files",
  outDir: "../../docs/public/examples/plain",
  theme: createPlainTheme(),
});
