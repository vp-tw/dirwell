import { createDefaultTheme, defineConfig } from "../../src/index.ts";
import { exampleMetadata } from "../metadata.ts";

export default defineConfig({
  root: "files",
  theme: createDefaultTheme({ project: { name: "Sample downloads" } }),
  metadata: exampleMetadata({
    theme: "ledger",
    siteName: "Sample downloads",
    subject: "Browse sample release files and archives.",
    imageDescription: "Release files and archives",
  }),
  outDir: "../../docs/public/examples/basic",
});
