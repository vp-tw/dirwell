import { createPlainTheme, defineConfig } from "../../src/index.ts";

export default defineConfig({
  root: "files",
  outDir: "../../site/examples/plain",
  theme: createPlainTheme(),
});
