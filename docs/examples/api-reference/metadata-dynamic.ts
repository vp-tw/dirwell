import {
  createCrosswaveTheme,
  createShareImage,
  defineConfig,
  describeContent,
} from "@vp-tw/dirwell";

export default defineConfig({
  root: "files",
  theme: createCrosswaveTheme({ project: { name: "Design kit" } }),
  metadata: {
    description: ({ directory }) => describeContent(directory),
    image: async ({ directory, site, description }) => ({
      source: await createShareImage({
        theme: "crosswave",
        repositoryName: site.repositoryName,
        title: directory.relativePath || site.name,
        description,
        directoryPath: directory.relativePath,
      }),
      outputPath: `og/${directory.relativePath || "root"}.png`,
    }),
  },
});
