import { createShareImage, describeContent } from "../src/index.ts";
import type { MetadataOptions, ShareImageOptions } from "../src/index.ts";

/** Content-specific example text with one archive cover shared by every folder. */
export function exampleMetadata(options: {
  readonly theme: NonNullable<ShareImageOptions["theme"]>;
  readonly siteName: string;
  readonly subject: string;
  readonly imageDescription: string;
}): MetadataOptions {
  const { theme, siteName, subject, imageDescription } = options;
  const themeName = { ledger: "Ledger", plain: "Plain", crosswave: "Crosswave" }[theme];
  return {
    siteName,
    title: ({ directory }) =>
      directory.relativePath
        ? `${directory.relativePath} · ${siteName}`
        : `${siteName} · ${themeName} demo`,
    description: ({ site, directory }) =>
      directory.relativePath
        ? `Browse ${directory.relativePath} in ${siteName}. This folder: ${describeContent(directory)}.`
        : `${subject} Archive totals: ${describeContent(site)}.`,
    image: async ({ site }) => ({
      source: await createShareImage({
        theme,
        repositoryName: site.repositoryName,
        title: siteName,
        description: `${imageDescription} · ${site.fileCount} ${site.fileCount === 1 ? "file" : "files"} across the archive`,
      }),
      alt: `${themeName} cover for ${siteName}: ${imageDescription}. Archive totals: ${describeContent(site)}.`,
    }),
  };
}
