import { defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  root: "files",
  metadata: {
    title: "Design kit",
    description: "Brand assets and reference documents",
    image: { source: "./cover.png", outputPath: "og/cover.png", alt: "Design kit cover" },
  },
});
