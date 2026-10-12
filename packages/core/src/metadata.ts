export interface ContentCounts {
  readonly folderCount: number;
  readonly fileCount: number;
  readonly linkCount: number;
}
export interface MetadataContext {
  readonly site: ContentCounts & { readonly name: string; readonly repositoryName: string };
  readonly directory: ContentCounts & { readonly relativePath: string; readonly name: string };
}
export type MetadataValue<T> = T | ((metadata: MetadataContext) => T | Promise<T>);
export type ImageSource = File | string | URL;
export interface MetadataImage {
  readonly source: ImageSource;
  /** Relative to the generated output root, never a source-file path. */
  readonly outputPath?: string;
  readonly alt?: string;
}
export interface ResolvedMetadataContext extends MetadataContext {
  readonly title: string;
  readonly description: string;
}
/** Fixed image, disabled image, or a build-time callback with resolved page text. */
export type MetadataImageValue =
  | ImageSource
  | MetadataImage
  | false
  | ((
      metadata: ResolvedMetadataContext,
    ) => ImageSource | MetadataImage | false | Promise<ImageSource | MetadataImage | false>);
export interface MetadataOptions {
  /** Default page/image name; falls back to the built-in theme’s project.name. */
  readonly siteName?: string;
  /** Image header label; falls back to the repository URL’s owner/path. */
  readonly repositoryName?: string;
  /** Deployed explorer root, including its deployment base; never the repository URL. */
  readonly siteUrl?: string;
  /** Page title; defaults to site name at root and path · site name in child folders. */
  readonly title?: MetadataValue<string>;
  /** Root descriptions use archive totals; child descriptions use direct folder counts. */
  readonly description?: MetadataValue<string>;
  readonly image?: MetadataImageValue;
}
export interface ThemeMetadataDefaults {
  /** Set false to resolve metadata only when the caller explicitly configures it. */
  readonly enabledByDefault?: boolean;
  readonly siteName: string;
  readonly repositoryName: string;
  /** Built-in preset, used only when neither caller nor theme provides image. */
  readonly imageTheme?: "ledger" | "plain" | "crosswave";
  /** Caller metadata.image takes precedence, including false. Omit both for text only. */
  readonly image?: MetadataImageValue;
}
export interface PageMetadata {
  readonly title: string;
  readonly description: string;
  readonly head: string;
}
