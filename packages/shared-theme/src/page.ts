import path from "node:path";
import { createHash } from "node:crypto";
import { projectListingEntry, copyJsonObject } from "@dirwell/core";
import type {
  ListingEntry,
  ThemeContext,
  ListingPage,
  SortOptions,
  ExplorerTheme,
} from "@dirwell/core";
export interface ThemePage {
  readonly version: 1;
  readonly theme: string;
  readonly title: string;
  readonly metadataHead?: string;
  readonly path: string;
  readonly rootHref: string;
  readonly parentHref: string | null;
  readonly parentDataHref: string | null;
  readonly rootDataHref: string;
  readonly dataHref: string;
  readonly manifestHref: string | null;
  readonly listingRevision?: string;
  readonly updatesHref: string | null;
  readonly total: number;
  readonly entries: readonly ListingEntry[];
  readonly sort: Required<SortOptions>;
  readonly page: ListingPage | null;
  readonly breadcrumbs: readonly {
    readonly name: string;
    readonly href: string;
    readonly dataHref: string;
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
  const fake = "https://dirwell.invalid/";
  const base = new URL(
    context.documentBaseHref ?? `${context.directoryPath ? context.directoryPath + "/" : ""}`,
    fake,
  );
  const root = new URL(context.hrefForDirectory(""), base);
  const target = new URL(entry.href, base);
  const rootPath = root.pathname.endsWith("/")
    ? root.pathname
    : root.pathname.slice(0, root.pathname.lastIndexOf("/") + 1);
  const directoryPath = target.pathname.endsWith("/")
    ? target.pathname
    : target.pathname.slice(0, target.pathname.lastIndexOf("/") + 1);
  const logical = directoryPath
    .slice(rootPath.length)
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent)
    .join("/");
  const filename = pageAsset(theme, logical);
  if (context.pageDataHref !== undefined) return context.pageDataHref(theme, logical, 1);
  if (context.mode === "mpa") return context.assetHref(filename);
  const href = new URL(filename, new URL(directoryPath, target));
  if (href.origin !== new URL(fake).origin) return href.href;
  if (context.documentBaseHref === null && !entry.href.startsWith("/")) {
    return path.posix
      .relative(context.directoryPath || ".", path.posix.join(logical, filename))
      .split("/")
      .map((segment) =>
        segment === ".." || segment === "." ? segment : encodeURIComponent(segment),
      )
      .join("/");
  }
  return href.pathname;
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
    hrefForDirectory: context.hrefForDirectory,
    documentBaseHref: context.documentBaseHref,
    directoryPath,
  };
  const dataForDirectory = (logicalPath: string) =>
    folderDataHref(
      {
        id: logicalPath,
        name: logicalPath,
        kind: "directory",
        href: context.hrefForDirectory(logicalPath),
        exitsExplorer: false,
        size: 0,
        modifiedAt: "",
        link: null,
      },
      safeContext,
      theme.name,
    )!;
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
