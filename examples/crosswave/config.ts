import path from "node:path";
import type { GenerateOptions } from "@dirwell/core";
import { createCrosswaveTheme } from "@dirwell/theme-crosswave";
import { exampleMetadata } from "../metadata.ts";

export default {
  sourceDir: path.join(import.meta.dirname, "files"),
  outputDir: path.resolve(import.meta.dirname, "../../docs/public/examples/crosswave"),
  metadata: exampleMetadata({
    siteUrl: `https://vp-tw.github.io${(process.env.DIRWELL_SITE_BASE ?? "/").replace(/\/$/, "")}/examples/crosswave/`,
    theme: "crosswave",
    siteName: "Sample media files",
    subject: "Browse sample images, audio, and video.",
    imageDescription: "Images, audio, and video",
  }),
  theme: createCrosswaveTheme({ title: "Sample media files", color: "azure" }),
} satisfies GenerateOptions;
