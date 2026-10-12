import type { JsonObject } from "./json.ts";
import { createHash } from "node:crypto";
import type { EntryKind, FileSystemEntry, ThemeContext, SortOptions } from "./model.ts";

/** Public transport fields only. Internal filesystem metadata must never be spread here. */
export interface ListingEntry {
  readonly presentation?: JsonObject;
  readonly id: string;
  readonly name: string;
  readonly kind: EntryKind;
  readonly href: string | null;
  readonly exitsExplorer: boolean;
  readonly size: number;
  readonly modifiedAt: string;
  readonly link: null | {
    readonly target: string;
    readonly targetKind: Exclude<EntryKind, "symlink"> | null;
    readonly targetSize: number | null;
    readonly unavailable: boolean;
    readonly cycle: boolean;
  };
}
export interface ListingPlan {
  readonly html:
    | { readonly strategy: "all" }
    | { readonly strategy: "paged"; readonly pageSize: number };
  readonly data:
    | { readonly strategy: "all" }
    | { readonly strategy: "blocks"; readonly blockSize: number };
}
export interface ListingPolicyContext {
  readonly operation?: "build" | "server";
  readonly directoryPath: string;
  readonly visibleCount: number;
  readonly dataBytes: number;
  readonly mode: "ssg" | "mpa";
  readonly supportsPagination: boolean;
}
export type ListingPolicy = ListingPlan | ((context: ListingPolicyContext) => ListingPlan);
export interface ListingPage {
  readonly number: number;
  readonly count: number;
  readonly offset: number;
  readonly total: number;
  readonly href: string;
  readonly previousHref: string | null;
  readonly nextHref: string | null;
}
export interface ListingContext {
  readonly revision: string;
  readonly manifestHref: string;
  readonly page: ListingPage;
}
export interface ListingBlock {
  readonly version: 1;
  readonly revision: string;
  readonly offset: number;
  readonly total: number;
  readonly entries: readonly ListingEntry[];
}
export interface ListingManifest {
  readonly version: 1;
  readonly revision: string;
  readonly directory: string;
  /** Resolve entry hrefs against this URL, resolved relative to the manifest URL. */
  readonly hrefBase: string;
  readonly total: number;
  readonly sort: Required<SortOptions>;
  /** Block hrefs are relative to the manifest URL. */
  readonly blocks: readonly {
    readonly href: string;
    readonly offset: number;
    readonly count: number;
  }[];
}

export function projectListingEntry(
  entry: FileSystemEntry,
  context: Pick<ThemeContext, "hrefFor" | "exitsExplorerFor">,
): ListingEntry {
  const link = entry.symlink;
  return {
    id: entry.relativePath,
    name: entry.name,
    kind: entry.kind,
    href: context.hrefFor(entry),
    exitsExplorer: context.exitsExplorerFor(entry),
    size: entry.metadata.size,
    modifiedAt: entry.metadata.times.modifiedAt,
    link:
      link === null
        ? null
        : {
            target: link.target,
            targetKind: link.targetKind,
            targetSize: link.targetSize ?? null,
            unavailable: link.isBroken || link.isOutsideRoot || Boolean(link.isTargetExcluded),
            cycle: link.isCycle,
          },
  };
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function positiveInteger(value: unknown, key: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new TypeError(`${key} must be a positive safe integer`);
}
export function validateListingPlan(value: unknown): asserts value is ListingPlan {
  if (!record(value) || !record(value.html) || !record(value.data))
    throw new TypeError("listing must contain html and data plans");
  if (value.html.strategy === "paged")
    positiveInteger(value.html.pageSize, "listing.html.pageSize");
  else if (value.html.strategy !== "all")
    throw new TypeError('listing.html.strategy must be "all" or "paged"');
  if (value.data.strategy === "blocks")
    positiveInteger(value.data.blockSize, "listing.data.blockSize");
  else if (value.data.strategy !== "all")
    throw new TypeError('listing.data.strategy must be "all" or "blocks"');
}
export function listingRevision(
  entries: readonly ListingEntry[],
  sort: Required<SortOptions>,
  hrefBase: string,
  blockSize: number,
): string {
  return createHash("sha256")
    .update(JSON.stringify({ version: 1, entries, sort, hrefBase, blockSize }))
    .digest("hex");
}
