import { createLightweightTheme, defineConfig } from "../../src/index.ts";

export default defineConfig({
  root: "files",
  outDir: "../../site/examples/lightweight",
  theme: createLightweightTheme(),
});
