import {
  createCrosswaveTheme,
  createShareImage,
  defineConfig,
  describeContent,
} from "../../src/index.ts";

export default defineConfig({
  root: "files",
  outDir: "../../docs/public/examples/dynamic-og",
  theme: createCrosswaveTheme({ project: { name: "Design kit" } }),
  metadata: {
    siteName: "Design kit",
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
});
