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
  const { metadata, metadataBaseDirectory, theme = defaultTheme } = options;
  // Project the declared Core contract; host/facade state is not a Core option.
  const coreOptions = {
    sourceDir: options.sourceDir,
    outputDir: options.outputDir,
    ...(options.base === undefined ? {} : { base: options.base }),
    ...(options.include === undefined ? {} : { include: options.include }),
    ...(options.exclude === undefined ? {} : { exclude: options.exclude }),
    ...(options.ignoreFiles === undefined ? {} : { ignoreFiles: options.ignoreFiles }),
    ...(options.entryData === undefined ? {} : { entryData: options.entryData }),
    ...(options.fileHref === undefined ? {} : { fileHref: options.fileHref }),
    ...(options.dryRun === undefined ? {} : { dryRun: options.dryRun }),
    ...(options.outputPolicy === undefined ? {} : { outputPolicy: options.outputPolicy }),
    ...(options.listing === undefined ? {} : { listing: options.listing }),
    ...(options.sort === undefined ? {} : { sort: options.sort }),
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.mirror === undefined ? {} : { mirror: options.mirror }),
    ...(options.outputName === undefined ? {} : { outputName: options.outputName }),
    ...(options.routing === undefined ? {} : { routing: options.routing }),
    ...(options.urlStrategy === undefined ? {} : { urlStrategy: options.urlStrategy }),
    ...(options.symlinks === undefined ? {} : { symlinks: options.symlinks }),
  };
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
