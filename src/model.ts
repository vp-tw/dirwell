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

export interface ThemeContext {
  readonly directory: DirectoryData;
  readonly outputName: string;
  readonly mode: "mpa" | "ssg";
  readonly assetHref: (assetName: string) => string;
  readonly hrefFor: (entry: FileSystemEntry) => string | null;
  readonly exitsExplorerFor: (entry: FileSystemEntry) => boolean;
}

export interface ExplorerTheme {
  readonly name: string;
  readonly render: (context: ThemeContext) => RenderedPage | Promise<RenderedPage>;
}

export interface GenerateOptions {
  readonly sourceDir: string;
  readonly outputDir: string;
  readonly mode?: "mpa" | "ssg";
  readonly mirror?: boolean;
  readonly outputName?: OutputNameResolver;
  readonly theme?: ExplorerTheme;
  readonly symlinks?: {
    readonly follow?: boolean;
    readonly boundary?: "anywhere" | "root";
    readonly onCycle?: "error" | "skip";
  };
}
