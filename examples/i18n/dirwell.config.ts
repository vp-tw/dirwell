import { defineConfig } from "../../src/index.ts";
import { internationalTheme } from "./theme.ts";

export default defineConfig({
  root: "files",
  outDir: "../../docs/public/examples/i18n",
  theme: internationalTheme,
});
