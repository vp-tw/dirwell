import path from "node:path";
import type { GenerateOptions } from "@dirwell/core";
import { internationalTheme } from "./theme.ts";

export default {
  sourceDir: path.join(import.meta.dirname, "files"),
  outputDir: path.resolve(import.meta.dirname, "../../docs/public/examples/i18n"),
  theme: internationalTheme,
} satisfies GenerateOptions;
