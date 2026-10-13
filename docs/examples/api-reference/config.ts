import type { CliConfig } from "@dirwell/cli";
import { createLedgerTheme } from "@dirwell/theme-ledger";
import { createMetadataProvider, createShareImage, describeContent } from "@dirwell/share-image";
export default {
  theme: createLedgerTheme({ title: "Downloads" }),
  build: {
    metadata: createMetadataProvider(
      {
        siteName: "Downloads",
        siteUrl: "https://example.com/downloads/",
        description: ({ directory }) => describeContent(directory),
        image: async ({ directory, title, description }) => ({
          source: await createShareImage({ theme: "ledger", title, description }),
          outputPath: `og/${directory.relativePath || "root"}.png`,
        }),
      },
      { siteName: "Downloads", repositoryName: "you/downloads" },
    ),
  },
  server: { port: 3000, exclude: ["drafts/**"], live: { intervalMs: 1000 } },
} satisfies CliConfig;
