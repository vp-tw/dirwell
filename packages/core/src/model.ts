import type { JsonObject } from "./json.ts";
import type { ListingEntry, ListingContext, ListingPolicy } from "./listing.ts";
import type { PageMetadata, ThemeMetadataDefaults } from "./metadata.ts";
export type EntryKind = "directory" | "file" | "symlink" | "other";

export interface FileTimes {
  readonly accessedAt: string;
  readonly changedAt: string;
  readonly createdAt: string;
  readonly modifiedAt: string;
}

export interface FileMetadata {
  readonly device: number;
  readonly groupId: number;
  readonly inode: number;
  readonly mode: number;
  readonly hardLinkCount: number;
  readonly size: number;
  readonly ownerId: number;
  readonly times: FileTimes;
}

export interface SymlinkMetadata {
  readonly target: string;
  readonly resolvedPath: string | null;
  readonly targetRelativePath: string | null;
  readonly targetKind: Exclude<EntryKind, "symlink"> | null;
  readonly targetSize?: number | null;
  readonly isBroken: boolean;
  readonly isCycle: boolean;
  readonly isOutsideRoot: boolean;
  readonly isTargetExcluded?: boolean;
  readonly wasFollowed: boolean;
}

export interface FileSystemEntry {
  /** Explicitly supplied public annotations, distinct from private filesystem facts. */
  readonly publicData?: JsonObject;
  readonly name: string;
  /** Node-side source path; custom themes must not serialize it into public output. */
  readonly absolutePath: string;
  readonly relativePath: string;
  readonly kind: EntryKind;
  readonly metadata: FileMetadata;
  readonly symlink: SymlinkMetadata | null;
}

export interface DirectoryData {
  readonly root: FileSystemEntry;
  readonly current: FileSystemEntry & { readonly kind: "directory" };
  readonly parent: FileSystemEntry | null;
  readonly depth: number;
  readonly entries: readonly FileSystemEntry[];
}

export type OutputNameResolver = (
  directory: DirectoryData,
) => string | null | Promise<string | null>;

export interface RenderedPage {
  /** Complete document. Escape source names and other untrusted text before insertion. */
  readonly html: string;
  readonly assets?: Readonly<Record<string, string | Uint8Array>>;
}

export type SortField = "modified" | "name" | "size";
export type NameSortMode = "locale" | "natural" | "unicode";
export type SortDirection = "asc" | "desc";
export type EntryDataProvider = (
  entry: Omit<ListingEntry, "href" | "exitsExplorer" | "presentation" | "data">,
  context: { readonly operation: "build" | "server"; readonly directoryPath: string },
) => JsonObject | Promise<JsonObject>;

export type IgnoreFile =
  | string
  | {
      readonly path: string;
      /** Pattern base; defaults to the ignore file's directory. Paths resolve from cwd. */
      readonly baseDir?: string;
      /** Missing optional files are skipped; unreadable files always fail. */
      readonly optional?: boolean;
    };

export interface SortOptions {
  readonly direction?: SortDirection;
  readonly directoriesFirst?: boolean;
  readonly field?: SortField;
  readonly nameMode?: NameSortMode;
}

export interface ThemeContext {
  readonly operation?: "build" | "server";
  readonly updatesHref?: string;
  readonly searchQueryHref?: string;
  readonly searchRefreshIntervalMs?: number;
  /** Optional host route for live framework page snapshots. */
  readonly pageDataHref?: (theme: string, directoryPath: string, page: number) => string;
  /** Present only when core listing publication is enabled. Entries are the current HTML slice. */
  readonly listing?: ListingContext;
  readonly metadata?: PageMetadata;
  readonly documentBaseHref: string | null;
  readonly directory: DirectoryData;
  readonly outputName: string;
  readonly mode: "mpa" | "ssg";
  readonly searchIndexHref: string;
  readonly sort: Required<SortOptions>;
  readonly assetHref: (assetName: string) => string;
  readonly hrefForDirectory: (relativePath: string) => string;
  readonly hasPageForDirectory?: (relativePath: string) => boolean;
  readonly hrefFor: (entry: FileSystemEntry) => string | null;
  readonly exitsExplorerFor: (entry: FileSystemEntry) => boolean;
}

export interface ExplorerTheme {
  /** Node-side derivation receives public facts only, never raw stat/source paths. */
  readonly entryData?: (
    entry: ListingEntry,
    context: Pick<
      ThemeContext,
      "mode" | "outputName" | "assetHref" | "hrefForDirectory" | "documentBaseHref" | "pageDataHref"
    > & { readonly directoryPath: string },
  ) => JsonObject;
  /** Opt in only when the renderer handles listing.page and emits native pagination anchors. */
  readonly listing?: { readonly pagination: boolean };
  readonly metadataDefaults?: ThemeMetadataDefaults;
  readonly name: string;
  /** Set to false when the theme does not offer global search. */
  readonly searchIndex?: boolean;
  /** Owns the document and assets; async renderers are awaited before output replacement. */
  readonly render: (context: ThemeContext) => RenderedPage | Promise<RenderedPage>;
}

export interface GenerateOptions {
  /** Synchronous public file URL mapping, independent of explorer/data/asset URLs. */
  readonly fileHref?: (logicalPath: string) => string | null;
  readonly entryData?: EntryDataProvider;
  /** Inspect filesystem selection and planned directory pages without writing output. */
  readonly dryRun?: boolean;
  /** Nonempty outputs require an ownership marker unless replacement is explicit. */
  readonly outputPolicy?: "owned" | "replace";
  /** Opt-in data publication and independently planned HTML pagination. */
  readonly listing?: ListingPolicy;
  /** Optional Node-side metadata provider; core supplies no image implementation. */
  readonly metadata?: MetadataProviderFactory;
  readonly base?: string;
  readonly include?: string | readonly string[];
  readonly exclude?: string | readonly string[];
  /** Ordered Git-style ignore files; none are discovered by Core. */
  readonly ignoreFiles?: readonly IgnoreFile[];
  readonly sourceDir: string;
  /** Dedicated output tree, replaced after a successful build. Keep unrelated files elsewhere. */
  readonly outputDir: string;
  readonly mode?: "mpa" | "ssg";
  readonly mirror?: boolean;
  readonly outputName?: OutputNameResolver | string;
  readonly theme: ExplorerTheme;
  /** Equivalent to `urls` in dirwell.config.ts; defaults to portable relative links. */
  readonly urlStrategy?: "base" | "html-base" | "relative";
  readonly symlinks?: {
    readonly follow?: boolean;
    readonly boundary?: "anywhere" | "root";
    readonly onCycle?: "error" | "skip";
  };
  readonly sort?: SortOptions;
}

export interface BuildReport {
  readonly sourceDir: string;
  readonly outputDir: string;
  readonly theme: string;
  readonly dryRun: boolean;
  readonly mirror: boolean;
  readonly replacesOutput: boolean;
  readonly selectedPaths: readonly string[];
  readonly pages: readonly { readonly directory: string; readonly outputName: string | null }[];
}

export interface MetadataProvider {
  readonly assets: ReadonlyMap<string, Uint8Array>;
  readonly resolve: (
    directory: DirectoryData,
    hrefForFile: (path: string) => string,
    pagePath: string,
  ) => PageMetadata | Promise<PageMetadata>;
}
export type MetadataProviderFactory = (context: {
  readonly sourceDir: string;
  readonly sourceKinds: ReadonlyMap<string, string>;
}) => MetadataProvider | Promise<MetadataProvider>;
