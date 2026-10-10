import { createDefaultTheme, defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  root: "files",
  theme: createDefaultTheme({
    project: { name: "Downloads", repositoryUrl: "https://github.com/you/downloads" },
  }),
  metadata: { siteUrl: "https://example.com/downloads/" },
});
