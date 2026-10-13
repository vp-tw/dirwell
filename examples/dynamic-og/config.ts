import path from "node:path";
import type { GenerateOptions } from "@dirwell/core";
import { createMetadataProvider, createShareImage, describeContent } from "@dirwell/share-image";
import { createCrosswaveTheme } from "@dirwell/theme-crosswave";

export default {
  sourceDir: path.join(import.meta.dirname, "files"),
  outputDir: path.resolve(import.meta.dirname, "../../docs/public/examples/dynamic-og"),
  theme: createCrosswaveTheme({ title: "Design kit" }),
  metadata: createMetadataProvider(
    {
      siteName: "Design kit",
      siteUrl: `https://vp-tw.github.io${(process.env.DIRWELL_SITE_BASE ?? "/").replace(/\/$/, "")}/examples/dynamic-og/`,
      repositoryName: "vp-tw/dirwell",
      title: ({ directory, site }) =>
        directory.relativePath ? `${directory.relativePath} · ${site.name}` : site.name,
      description: ({ directory }) => describeContent(directory),
      image: async ({ directory, site, description }) => ({
        source: await createShareImage({
          theme: "crosswave",
          repositoryName: site.repositoryName,
          title: directory.relativePath || site.name,
          description,
          directoryPath: directory.relativePath,
        }),
        // Unique output-root paths for each directory; PNGs are built before deployment.
        outputPath: `og/${directory.relativePath || "root"}.png`,
        alt: `${directory.relativePath || site.name}: ${description}`,
      }),
    },
    { siteName: "Design kit", repositoryName: "vp-tw/dirwell" },
  ),
} satisfies GenerateOptions;
