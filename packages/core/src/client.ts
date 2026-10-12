import { copyJsonObject } from "./json.ts";
import type { ListingEntry, ListingManifest, ListingBlock } from "./listing.ts";

export class ListingDataError extends Error {
  override readonly name = "ListingDataError";
}
class StaleListingError extends ListingDataError {}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const kind = (value: unknown): value is ListingEntry["kind"] =>
  typeof value === "string" && ["directory", "file", "symlink", "other"].includes(value);
function string(value: unknown, name: string): string {
  if (typeof value !== "string") throw new ListingDataError(`Invalid ${name}`);
  return value;
}
function boolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new ListingDataError(`Invalid ${name}`);
  return value;
}
function href(value: unknown, base: URL): string | null {
  if (value === null) return null;
  const result = new URL(string(value, "href"), base);
  if (!["http:", "https:"].includes(result.protocol))
    throw new ListingDataError("Unsupported listing link protocol");
  return result.href;
}
function entry(value: unknown, base: URL): ListingEntry {
  if (
    !object(value) ||
    !kind(value.kind) ||
    typeof value.size !== "number" ||
    !Number.isFinite(value.size) ||
    value.size < 0
  )
    throw new ListingDataError("Invalid listing entry");
  let link: ListingEntry["link"] = null;
  if (value.link !== null) {
    if (!object(value.link)) throw new ListingDataError("Invalid link metadata");
    const targetKind = value.link.targetKind;
    if (targetKind !== null && (!kind(targetKind) || targetKind === "symlink"))
      throw new ListingDataError("Invalid target kind");
    const targetSize = value.link.targetSize;
    if (
      targetSize !== null &&
      (typeof targetSize !== "number" || !Number.isFinite(targetSize) || targetSize < 0)
    )
      throw new ListingDataError("Invalid target size");
    link = {
      target: string(value.link.target, "target"),
      targetKind,
      targetSize,
      unavailable: boolean(value.link.unavailable, "unavailable"),
      cycle: boolean(value.link.cycle, "cycle"),
    };
  }
  return {
    ...(value.presentation === undefined
      ? {}
      : { presentation: copyJsonObject(value.presentation) }),
    id: string(value.id, "id"),
    name: string(value.name, "name"),
    kind: value.kind,
    href: href(value.href, base),
    exitsExplorer: boolean(value.exitsExplorer, "exitsExplorer"),
    size: value.size,
    modifiedAt: string(value.modifiedAt, "modifiedAt"),
    link,
  };
}
function manifest(value: unknown): ListingManifest {
  if (
    !object(value) ||
    value.version !== 1 ||
    !count(value.total) ||
    !Array.isArray(value.blocks) ||
    !object(value.sort)
  )
    throw new ListingDataError("Invalid listing manifest");
  const sort = value.sort;
  if (
    typeof sort.field !== "string" ||
    !["name", "size", "modified"].includes(sort.field) ||
    typeof sort.direction !== "string" ||
    !["asc", "desc"].includes(sort.direction) ||
    typeof sort.nameMode !== "string" ||
    !["locale", "natural", "unicode"].includes(sort.nameMode) ||
    typeof sort.directoriesFirst !== "boolean"
  )
    throw new ListingDataError("Invalid listing order");
  // Guarded enum members are copied through explicit branches, without trusting an assertion.
  const field = sort.field === "size" ? "size" : sort.field === "modified" ? "modified" : "name";
  const direction = sort.direction === "desc" ? "desc" : "asc";
  const nameMode =
    sort.nameMode === "unicode" ? "unicode" : sort.nameMode === "locale" ? "locale" : "natural";
  const blocks = value.blocks.map((item: unknown) => {
    if (!object(item) || !count(item.offset) || !count(item.count))
      throw new ListingDataError("Invalid block descriptor");
    return { href: string(item.href, "block href"), offset: item.offset, count: item.count };
  });
  if (blocks.length === 0) throw new ListingDataError("Missing blocks");
  return {
    version: 1,
    revision: string(value.revision, "revision"),
    directory: string(value.directory, "directory"),
    hrefBase: string(value.hrefBase, "href base"),
    total: value.total,
    sort: { field, direction, nameMode, directoriesFirst: sort.directoriesFirst },
    blocks,
  };
}
export interface LoadedListing {
  readonly manifest: ListingManifest;
  /** Hrefs have been normalized to absolute HTTP(S) URLs. */
  readonly entries: readonly ListingEntry[];
}
/** Load a coherent static listing; retry a stale/missing block once using a fresh manifest. */
export async function loadListing(
  manifestUrl: string,
  options: {
    readonly fetch?: typeof fetch;
    readonly signal?: AbortSignal;
    readonly maxEntries?: number;
    readonly cache?: RequestCache;
  } = {},
): Promise<LoadedListing> {
  const request = options.fetch ?? fetch;
  const maxEntries = options.maxEntries ?? 100000;
  if (!count(maxEntries)) throw new ListingDataError("Invalid entry limit");
  const source = new URL(manifestUrl);
  if (!["http:", "https:"].includes(source.protocol))
    throw new ListingDataError("Listing loading requires HTTP(S); use native file navigation");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const init: RequestInit = {
        ...(options.signal === undefined ? {} : { signal: options.signal }),
        cache: attempt === 0 ? (options.cache ?? "default") : "reload",
      };
      const response = await request(source, init);
      if (!response.ok) throw new ListingDataError(`Manifest request failed: ${response.status}`);
      const current = manifest(await response.json());
      if (current.total > maxEntries)
        throw new ListingDataError("Listing exceeds the configured entry limit");
      const base = new URL(current.hrefBase, source);
      if (!["http:", "https:"].includes(base.protocol))
        throw new ListingDataError("Unsupported href base protocol");
      const entries: ListingEntry[] = [];
      const ids = new Set<string>();
      for (const descriptor of current.blocks) {
        if (
          descriptor.offset !== entries.length ||
          descriptor.count + entries.length > current.total
        )
          throw new ListingDataError("Invalid block coverage");
        const blockUrl = new URL(descriptor.href, source);
        if (blockUrl.origin !== source.origin || !["http:", "https:"].includes(blockUrl.protocol))
          throw new ListingDataError("Block leaves the manifest origin");
        const blockResponse = await request(blockUrl, init);
        if (blockResponse.status === 404 || blockResponse.status === 410)
          throw new StaleListingError("Block no longer available");
        if (!blockResponse.ok)
          throw new ListingDataError(`Block request failed: ${blockResponse.status}`);
        const data: unknown = await blockResponse.json();
        if (!object(data) || data.version !== 1 || data.revision !== current.revision)
          throw new StaleListingError("Listing revision changed");
        if (
          data.offset !== descriptor.offset ||
          data.total !== current.total ||
          !Array.isArray(data.entries) ||
          data.entries.length !== descriptor.count
        )
          throw new ListingDataError("Invalid block envelope");
        for (const raw of data.entries) {
          const record = entry(raw, base);
          if (ids.has(record.id)) throw new ListingDataError("Duplicate entry ID");
          ids.add(record.id);
          entries.push(record);
        }
      }
      if (entries.length !== current.total) throw new ListingDataError("Incomplete listing");
      return { manifest: current, entries };
    } catch (error) {
      if (options.signal?.aborted || !(error instanceof StaleListingError) || attempt === 1)
        throw error;
    }
  }
  throw new ListingDataError("Listing unavailable");
}
// Keep the transport type usable without importing Node-side implementation code.
export type { ListingBlock };

/** Validate a public page slice and normalize its navigation URLs. */
export function parseListingEntries(
  value: unknown,
  baseHref: string,
  maxEntries = 100_000,
): readonly ListingEntry[] {
  if (!Array.isArray(value) || value.length > maxEntries)
    throw new ListingDataError("Invalid page slice");
  const base = new URL(baseHref),
    ids = new Set<string>();
  const result = value.map((raw) => entry(raw, base));
  for (const record of result) {
    if (ids.has(record.id)) throw new ListingDataError("Duplicate entry ID");
    ids.add(record.id);
  }
  return result;
}
