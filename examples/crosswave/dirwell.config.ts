import { defineConfig, createCrosswaveTheme } from "../../src/index.ts";
import { exampleMetadata } from "../metadata.ts";

export default defineConfig({
  root: "files",
  outDir: "../../docs/public/examples/crosswave",
  metadata: exampleMetadata({
    theme: "crosswave",
    siteName: "Sample media files",
    subject: "Browse sample images, audio, and video.",
    imageDescription: "Images, audio, and video",
  }),
  theme: createCrosswaveTheme({ project: { name: "Sample media files" }, color: "azure" }),
});
