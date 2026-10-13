import path from "node:path";
import type { GenerateOptions } from "@dirwell/core";
import { createCatppuccinTheme } from "./theme.ts";

const theme = await createCatppuccinTheme(path.join(import.meta.dirname, ".generated-theme"));
export default {
  sourceDir: path.join(import.meta.dirname, "files"),
  outputDir: path.resolve(import.meta.dirname, "../../docs/public/examples/default-theme-override"),
  theme,
} satisfies GenerateOptions;
