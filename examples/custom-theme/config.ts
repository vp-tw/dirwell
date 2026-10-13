import path from "node:path";
import type { GenerateOptions } from "@dirwell/core";
import { releaseCatalogTheme } from "./theme.ts";

export default {
  sourceDir: path.join(import.meta.dirname, "files"),
  outputDir: path.resolve(import.meta.dirname, "../../docs/public/examples/custom-theme"),
  theme: releaseCatalogTheme,
} satisfies GenerateOptions;
