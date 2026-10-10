import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

const siteBase = process.env.SITE_BASE ?? "/";

export default defineConfig({
  base: siteBase,
  outDir: "../site",
  integrations: [
    starlight({
      title: "Dirwell",
      description: "A static file explorer that is easy to start and deep to customize.",
      social: [],
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "Overview", slug: "overview" },
            { label: "Getting started", slug: "getting-started" },
            { label: "Deployment", slug: "deployment" },
            { label: "Examples", slug: "examples" },
          ],
        },
        {
          label: "Customize and integrate",
          items: [
            { label: "Themes", slug: "themes" },
            { label: "Page metadata and share images", slug: "metadata" },
            { label: "Build tool adapters", slug: "build-tools" },
            { label: "Support and compatibility", slug: "support" },
          ],
        },
        {
          label: "Reference and help",
          items: [
            { label: "CLI", slug: "cli" },
            { label: "Configuration", slug: "configuration" },
            { label: "Symlinks", slug: "symlinks" },
            { label: "API reference", slug: "api-reference" },
            { label: "Troubleshooting", slug: "troubleshooting" },
          ],
        },
      ],
    }),
  ],
});
