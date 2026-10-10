import type { MetadataOptions, PageMetadata, ThemeMetadataDefaults } from "./metadata.ts";
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

export interface SortOptions {
  readonly direction?: SortDirection;
  readonly directoriesFirst?: boolean;
  readonly field?: SortField;
  readonly nameMode?: NameSortMode;
}

export interface ThemeContext {
  readonly metadata?: PageMetadata;
  readonly documentBaseHref: string | null;
  readonly directory: DirectoryData;
  readonly outputName: string;
  readonly mode: "mpa" | "ssg";
  readonly searchIndexHref: string;
  readonly sort: Required<SortOptions>;
  readonly assetHref: (assetName: string) => string;
  readonly hrefForDirectory: (relativePath: string) => string;
  readonly hrefFor: (entry: FileSystemEntry) => string | null;
  readonly exitsExplorerFor: (entry: FileSystemEntry) => boolean;
}

export interface ExplorerTheme {
  readonly metadataDefaults?: ThemeMetadataDefaults;
  readonly name: string;
  /** Set to false when the theme does not offer global search. */
  readonly searchIndex?: boolean;
  /** Owns the document and assets; async renderers are awaited before output replacement. */
  readonly render: (context: ThemeContext) => RenderedPage | Promise<RenderedPage>;
}

export interface GenerateOptions {
  readonly metadata?: MetadataOptions;
  /** Base directory for local metadata image paths; defaults to process.cwd(). */
  readonly metadataBaseDirectory?: string;
  readonly base?: string;
  readonly include?: string | readonly string[];
  readonly exclude?: string | readonly string[];
  readonly sourceDir: string;
  /** Dedicated output tree, replaced after a successful build. Keep unrelated files elsewhere. */
  readonly outputDir: string;
  readonly mode?: "mpa" | "ssg";
  readonly mirror?: boolean;
  readonly outputName?: OutputNameResolver | string;
  readonly theme?: ExplorerTheme;
  /** Equivalent to `urls` in dirwell.config.ts; defaults to portable relative links. */
  readonly urlStrategy?: "base" | "html-base" | "relative";
  readonly symlinks?: {
    readonly follow?: boolean;
    readonly boundary?: "anywhere" | "root";
    readonly onCycle?: "error" | "skip";
  };
  readonly sort?: SortOptions;
}
