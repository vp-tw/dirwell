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
          label: "Start",
          items: [
            { label: "Overview", slug: "overview" },
            { label: "Getting started", slug: "getting-started" },
            { label: "Examples", slug: "examples" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "CLI", slug: "cli" },
            { label: "Configuration", slug: "configuration" },
            { label: "API reference", slug: "api-reference" },
            { label: "Themes", slug: "themes" },
            { label: "Symlinks", slug: "symlinks" },
            { label: "Deployment", slug: "deployment" },
          ],
        },
      ],
    }),
  ],
});
