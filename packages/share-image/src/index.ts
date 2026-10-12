import type {
  MetadataOptions,
  ThemeMetadataDefaults,
  MetadataProviderFactory,
} from "@dirwell/core";
import { countKinds, createMetadataResolver } from "./metadata.ts";
export { createShareImage } from "./share-image-api.ts";
export type { ShareImageOptions } from "./share-image-api.ts";
export {
  countEntries,
  countKinds,
  describeContent,
  repositoryName,
  createMetadataResolver,
} from "./metadata.ts";
/** Opt-in build metadata. PNG presets are generated only when defaults.imageTheme is supplied. */
export function createMetadataProvider(
  options: MetadataOptions,
  defaults: ThemeMetadataDefaults,
  sourceDirectory = process.cwd(),
): MetadataProviderFactory {
  return ({ sourceKinds }) =>
    createMetadataResolver(options, defaults, countKinds(sourceKinds.values()), sourceDirectory);
}
