import type {
  GenerateOptions as CoreGenerateOptions,
  ExplorerTheme,
} from "../packages/core/src/model.ts";
import type { MetadataOptions } from "./metadata.ts";
export type {
  DirectoryData,
  EntryKind,
  ExplorerTheme,
  FileMetadata,
  FileSystemEntry,
  FileTimes,
  NameSortMode,
  OutputNameResolver,
  RenderedPage,
  SortDirection,
  SortField,
  SortOptions,
  SymlinkMetadata,
  ThemeContext,
} from "../packages/core/src/model.ts";
/** Legacy facade options retain defaults and automatic image presets. */
export interface GenerateOptions extends Omit<CoreGenerateOptions, "theme" | "metadata"> {
  readonly theme?: ExplorerTheme;
  readonly metadata?: MetadataOptions;
  readonly metadataBaseDirectory?: string;
}
