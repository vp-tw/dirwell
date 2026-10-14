import { generateExplorerSkippingPaths as generateCore } from "../packages/core/src/generator.ts";
import { countKinds, createMetadataResolver } from "./metadata.ts";
import { defaultTheme } from "./theme-default.ts";
import path from "node:path";
import type { GenerateOptions } from "./model.ts";

export {
  compareEntries,
  defaultOutputName,
  readGeneratedPage,
} from "../packages/core/src/generator.ts";

/** Compatibility facade: retains the legacy default theme and metadata presets. */
export async function generateExplorer(options: GenerateOptions): Promise<void> {
  return generateExplorerSkippingPaths(options, []);
}
export async function generateExplorerSkippingPaths(
  options: GenerateOptions,
  ignoredPaths: readonly string[],
): Promise<void> {
  const { metadata, metadataBaseDirectory, theme = defaultTheme, ...coreOptions } = options;
  const metadataEnabled =
    metadata !== undefined ||
    (theme.metadataDefaults !== undefined && theme.metadataDefaults.enabledByDefault !== false);
  await generateCore(
    {
      ...coreOptions,
      theme,
      ...(metadataEnabled
        ? {
            metadata: ({ sourceDir, sourceKinds }) =>
              createMetadataResolver(
                metadata ?? {},
                theme.metadataDefaults ?? {
                  siteName: path.basename(sourceDir),
                  repositoryName: "",
                  imageTheme: "ledger",
                },
                countKinds(sourceKinds.values()),
                metadataBaseDirectory ?? process.cwd(),
              ),
          }
        : {}),
    },
    ignoredPaths,
  );
}
