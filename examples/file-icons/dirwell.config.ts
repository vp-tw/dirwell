import { createDefaultTheme, defineConfig } from "../../src/index.ts";
import { exampleMetadata } from "../metadata.ts";

export default defineConfig({
  root: "files",
  theme: createDefaultTheme({ project: { name: "Sample files" } }),
  metadata: exampleMetadata({
    theme: "ledger",
    siteName: "Sample files",
    subject: "Browse sample source files and documentation.",
    imageDescription: "Source files and documentation",
  }),
  outDir: "../../docs/public/examples/file-icons",
});
