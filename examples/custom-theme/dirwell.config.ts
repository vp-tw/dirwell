import { defineConfig } from "../../src/index.ts";
import { releaseCatalogTheme } from "./theme.ts";

export default defineConfig({
  root: "files",
  outDir: "../../docs/public/examples/custom-theme",
  theme: releaseCatalogTheme,
});
