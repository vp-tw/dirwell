import path from "node:path";
import type { GenerateOptions } from "@dirwell/core";
import { createPlainTheme } from "@dirwell/theme-plain";

const config: GenerateOptions = {
  sourceDir: path.join(import.meta.dirname, "files"),
  outputDir: path.resolve(import.meta.dirname, "../../docs/public/examples/plain"),
  theme: createPlainTheme(),
};

export default config;
