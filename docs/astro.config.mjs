import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  integrations: [
    starlight({
      title: "Dirwell",
      description: "A static file explorer that is easy to start and deep to customize.",
      social: [],
      sidebar: [
        {
          label: "Start",
          items: [
            { label: "Overview", slug: "index" },
            { label: "Getting started", slug: "getting-started" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "CLI", slug: "cli" },
            { label: "Configuration", slug: "configuration" },
            { label: "Themes", slug: "themes" },
            { label: "Symlinks", slug: "symlinks" },
            { label: "Deployment", slug: "deployment" },
          ],
        },
      ],
    }),
  ],
});
