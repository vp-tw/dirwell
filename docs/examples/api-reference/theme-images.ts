import { createShareImage, type ThemeMetadataDefaults } from "@vp-tw/dirwell";

export const imageDefaults: ThemeMetadataDefaults = {
  siteName: "Downloads",
  repositoryName: "you/downloads",
  // Reuse a preset here, or return a File from your own image renderer.
  image: ({ site, title, description }) =>
    createShareImage({ theme: "plain", title, description, repositoryName: site.repositoryName }),
};
