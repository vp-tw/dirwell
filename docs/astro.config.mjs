import { defineConfig } from "astro/config";
import { exampleDirectoryIndexes } from "./example-index.ts";
import starlight from "@astrojs/starlight";
import {
  siteDescription,
  shareImagePath,
  shareImageWidth,
  shareImageHeight,
  shareImageAlt,
} from "./site-branding.mjs";

const siteBase = process.env.SITE_BASE ?? "/";
const siteOrigin = process.env.SITE_ORIGIN ?? "https://vp-tw.github.io";
const shareImageUrl = new URL(`${siteBase.replace(/\/?$/, "/")}${shareImagePath}`, siteOrigin).href;

export default defineConfig({
  site: siteOrigin,
  base: siteBase,
  outDir: "../site",
  vite: { plugins: [exampleDirectoryIndexes()] },
  integrations: [
    starlight({
      title: "Dirwell",
      description: siteDescription,
      favicon: "/brand/paper-bird.png",
      logo: { src: "./public/brand/paper-bird.png", alt: "", replacesTitle: false },
      head: [
        { tag: "meta", attrs: { property: "og:image", content: shareImageUrl } },
        { tag: "meta", attrs: { property: "og:image:type", content: "image/png" } },
        { tag: "meta", attrs: { property: "og:image:width", content: String(shareImageWidth) } },
        { tag: "meta", attrs: { property: "og:image:height", content: String(shareImageHeight) } },
        { tag: "meta", attrs: { property: "og:image:alt", content: shareImageAlt } },
        { tag: "meta", attrs: { name: "twitter:image", content: shareImageUrl } },
        { tag: "meta", attrs: { name: "twitter:image:alt", content: shareImageAlt } },
      ],
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
