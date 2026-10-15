import { createHash } from "node:crypto";
import { projectListingEntry, copyJsonObject } from "@dirwell/core";
import type {
  ListingEntry,
  ThemeContext,
  ListingPage,
  SortOptions,
  ExplorerTheme,
} from "@dirwell/core";
import type { ThemeCustomization } from "./customization.ts";
export interface ThemePage {
  readonly ui?: ThemeCustomization;
  readonly version: 1;
  readonly theme: string;
  readonly title: string;
  readonly metadataHead?: string;
  readonly path: string;
  readonly rootHref: string | null;
  readonly parentHref: string | null;
  readonly parentDataHref: string | null;
  readonly rootDataHref: string | null;
  readonly dataHref: string;
  readonly manifestHref: string | null;
  readonly listingRevision?: string;
  readonly updatesHref: string | null;
  readonly searchQueryHref?: string | null;
  readonly searchRefreshIntervalMs?: number;
  readonly total: number;
  readonly entries: readonly ListingEntry[];
  readonly sort: Required<SortOptions>;
  readonly page: ListingPage | null;
  readonly breadcrumbs: readonly {
    readonly name: string;
    readonly href: string | null;
    readonly dataHref: string | null;
  }[];
}
export const pageAsset = (theme: string, directory: string, page = 1) =>
  `${theme}-page-${createHash("sha256").update(directory).digest("hex").slice(0, 24)}-${page}.json`;
export function folderDataHref(
  entry: ListingEntry,
  context: Parameters<NonNullable<ExplorerTheme["entryData"]>>[1],
  theme: string,
): string | null {
  if (
    entry.exitsExplorer ||
    entry.href === null ||
    !(entry.kind === "directory" || entry.link?.targetKind === "directory")
  )
    return null;
  const logical = context.directoryPathForEntry(entry.id);
  if (logical === null) return null;
  return (
    context.pageDataHref?.(theme, logical, 1) ??
    context.assetHrefForDirectory(logical, pageAsset(theme, logical))
  );
}
export function createThemePage(
  context: ThemeContext,
  theme: ExplorerTheme,
  title: string,
): ThemePage {
  const directoryPath = context.directory.current.relativePath;
  const safeContext = {
    ...(context.pageDataHref === undefined ? {} : { pageDataHref: context.pageDataHref }),
    mode: context.mode,
    outputName: context.outputName,
    assetHref: context.assetHref,
    assetHrefForDirectory: context.assetHrefForDirectory,
    directoryPathForEntry: context.directoryPathForEntry,
    hrefForDirectory: context.hrefForDirectory,
    documentBaseHref: context.documentBaseHref,
    directoryPath,
  };
  const dataForDirectory = (logicalPath: string) =>
    context.hasPageForDirectory?.(logicalPath) === false
      ? null
      : (context.pageDataHref?.(theme.name, logicalPath, 1) ??
        context.assetHrefForDirectory(logicalPath, pageAsset(theme.name, logicalPath)));
  const entries = context.directory.entries.map((entry) => {
    const record = projectListingEntry(entry, context);
    return theme.entryData === undefined
      ? record
      : { ...record, presentation: copyJsonObject(theme.entryData(record, safeContext)) };
  });
  return {
    version: 1,
    ...(context.metadata === undefined ? {} : { metadataHead: context.metadata.head }),
    theme: theme.name,
    title: context.metadata?.title ?? (directoryPath ? `${directoryPath} · ${title}` : title),
    path: directoryPath,
    rootHref: context.hrefForDirectory(""),
    parentHref:
      context.directory.parent === null
        ? null
        : context.hrefForDirectory(context.directory.parent.relativePath),
    rootDataHref: dataForDirectory(""),
    parentDataHref:
      context.directory.parent === null
        ? null
        : dataForDirectory(context.directory.parent.relativePath),
    dataHref:
      context.pageDataHref?.(theme.name, directoryPath, context.listing?.page.number ?? 1) ??
      context.assetHref(pageAsset(theme.name, directoryPath, context.listing?.page.number ?? 1)),
    manifestHref: context.listing?.manifestHref ?? null,
    ...(context.listing ? { listingRevision: context.listing.revision } : {}),
    updatesHref: context.updatesHref ?? null,
    ...(context.searchQueryHref
      ? {
          searchQueryHref: context.searchQueryHref,
          searchRefreshIntervalMs: context.searchRefreshIntervalMs,
        }
      : {}),
    total: context.listing?.page.total ?? entries.length,
    entries,
    sort: context.sort,
    page: context.listing?.page ?? null,
    breadcrumbs: directoryPath
      .split("/")
      .filter(Boolean)
      .map((name, index) => ({
        name,
        dataHref: dataForDirectory(
          directoryPath
            .split("/")
            .slice(0, index + 1)
            .join("/"),
        ),
        href: context.hrefForDirectory(
          directoryPath
            .split("/")
            .slice(0, index + 1)
            .join("/"),
        ),
      })),
  };
}
