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
  readonly isBroken: boolean;
  readonly isCycle: boolean;
  readonly isOutsideRoot: boolean;
  readonly wasFollowed: boolean;
}

export interface FileSystemEntry {
  readonly name: string;
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
  readonly name: string;
  /** Set to false when the theme does not offer global search. */
  readonly searchIndex?: boolean;
  readonly render: (context: ThemeContext) => RenderedPage | Promise<RenderedPage>;
}

export interface GenerateOptions {
  readonly base?: string;
  readonly include?: string | readonly string[];
  readonly exclude?: string | readonly string[];
  readonly sourceDir: string;
  readonly outputDir: string;
  readonly mode?: "mpa" | "ssg";
  readonly mirror?: boolean;
  readonly outputName?: OutputNameResolver | string;
  readonly theme?: ExplorerTheme;
  readonly urlStrategy?: "base" | "html-base" | "relative";
  readonly symlinks?: {
    readonly follow?: boolean;
    readonly boundary?: "anywhere" | "root";
    readonly onCycle?: "error" | "skip";
  };
  readonly sort?: SortOptions;
}
