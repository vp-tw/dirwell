import { createPlainTheme, defineConfig } from "../../src/index.ts";
import { exampleMetadata } from "../metadata.ts";

export default defineConfig({
  root: "files",
  outDir: "../../docs/public/examples/plain",
  theme: createPlainTheme({ project: { name: "Sample downloads" } }),
  metadata: exampleMetadata({
    theme: "plain",
    siteName: "Sample downloads",
    subject: "Browse sample release notes and checksums.",
    imageDescription: "Release notes and checksums",
  }),
});
