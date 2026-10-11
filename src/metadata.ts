import { escapeHtml } from "./html.ts";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DirectoryData } from "./model.ts";

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
export function countEntries(directory: DirectoryData): ContentCounts {
  return countKinds(directory.entries.map((entry) => entry.kind));
}
export function countKinds(kinds: Iterable<string>): ContentCounts {
  let folderCount = 0,
    fileCount = 0,
    linkCount = 0;
  for (const kind of kinds) {
    if (kind === "directory") folderCount++;
    else if (kind === "file") fileCount++;
    else if (kind === "symlink") linkCount++;
  }
  return { folderCount, fileCount, linkCount };
}
export function describeContent(counts: ContentCounts): string {
  const parts: string[] = [];
  for (const [count, noun] of [
    [counts.folderCount, "folder"],
    [counts.fileCount, "file"],
    [counts.linkCount, "link"],
  ] as const) {
    if (count > 0) parts.push(`${count} ${noun}${count === 1 ? "" : "s"}`);
  }
  return parts.join(" · ") || "Empty folder";
}
export function repositoryName(repositoryUrl: string): string {
  try {
    return new URL(repositoryUrl).pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
  } catch {
    return repositoryUrl;
  }
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string") throw new TypeError(`${label} must resolve to a string`);
  return value;
}
function safeOutputPath(value: string): string {
  if (
    !value ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.startsWith("/") ||
    /^[a-z]:/i.test(value) ||
    value.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new Error(`Unsafe metadata image outputPath: ${value}`);
  if (value.startsWith("__dirwell/") && !value.startsWith("__dirwell/metadata/"))
    throw new Error("Metadata image cannot overwrite reserved Dirwell assets");
  return value;
}
function deployedRoot(value: string | undefined): URL | undefined {
  if (value === undefined) return undefined;
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error(
      "metadata.siteUrl must be an HTTP(S) explorer root without credentials, query, or fragment",
    );
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}
export function createMetadataResolver(
  options: MetadataOptions,
  defaults: ThemeMetadataDefaults,
  counts: ContentCounts,
  sourceDirectory: string,
) {
  const site = Object.freeze({
    ...counts,
    name: stringValue(options.siteName ?? defaults.siteName, "metadata.siteName"),
    repositoryName: stringValue(
      options.repositoryName ?? defaults.repositoryName,
      "metadata.repositoryName",
    ),
  });
  const siteUrl = deployedRoot(options.siteUrl);
  const presetTitle = typeof options.title === "string" ? options.title : site.name;
  const presetDescription =
    typeof options.description === "string"
      ? options.description
      : `Archive totals: ${describeContent(site)}`;
  const assets = new Map<string, Uint8Array>();
  let defaultImage: Promise<File> | undefined;
  // One source snapshot per build: fixed images should not reread or rehash per page.
  const fileSources = new WeakMap<
    File,
    Promise<{ bytes: Uint8Array; extension: string; digest: string }>
  >();
  const pathSources = new Map<
    string,
    Promise<{ bytes: Uint8Array; extension: string; digest: string }>
  >();
  const loaded = async (bytes: Uint8Array, filename: string) => {
    const extension = path.extname(filename).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension))
      throw new Error("Metadata images must be PNG, JPEG, WebP, or GIF files");
    return { bytes, extension, digest: createHash("sha256").update(bytes).digest("hex") };
  };
  function loadImage(source: ImageSource) {
    if (source instanceof File) {
      let image = fileSources.get(source);
      if (image === undefined) {
        image = source.arrayBuffer().then((buffer) => loaded(new Uint8Array(buffer), source.name));
        fileSources.set(source, image);
      }
      return image;
    }
    if (typeof source !== "string" && !(source instanceof URL))
      throw new TypeError("metadata.image.source must be a File, local path, or file URL");
    if (source instanceof URL && source.protocol !== "file:")
      throw new Error("metadata.image source URLs must use file:");
    const input =
      source instanceof URL ? fileURLToPath(source) : path.resolve(sourceDirectory, source);
    let image = pathSources.get(input);
    if (image === undefined) {
      image = readFile(input).then((bytes) => loaded(bytes, path.basename(input)));
      pathSources.set(input, image);
    }
    return image;
  }

  async function imageFor(
    context: ResolvedMetadataContext,
  ): Promise<{ outputPath: string; alt: string } | null> {
    const configured = options.image === undefined ? defaults.image : options.image;
    const isPreset = configured === undefined && defaults.imageTheme !== undefined;
    let image = typeof configured === "function" ? await configured(context) : configured;
    if (image === false) return null;
    if (configured === undefined) {
      const preset = defaults.imageTheme;
      if (preset === undefined) return null;
      defaultImage ??= import("./share-image-api.ts").then(({ createShareImage }) =>
        createShareImage({
          theme: preset,
          repositoryName: site.repositoryName,
          title: presetTitle,
          description: presetDescription,
        }),
      );
      image = await defaultImage;
    }
    if (image === undefined)
      throw new TypeError("metadata.image callback must return an image or false");
    const config: MetadataImage =
      image instanceof File || typeof image === "string" || image instanceof URL
        ? { source: image }
        : image;
    if (!config || typeof config !== "object")
      throw new TypeError(
        "metadata.image must resolve to a File, local path, file URL, or source object",
      );
    const { bytes, extension, digest } = await loadImage(config.source);
    const outputPath = safeOutputPath(
      config.outputPath ?? `__dirwell/metadata/${digest}${extension}`,
    );
    const existing = assets.get(outputPath);
    if (existing !== undefined && existing !== bytes && !Buffer.from(existing).equals(bytes))
      throw new Error(`Conflicting metadata image outputPath: ${outputPath}`);
    assets.set(outputPath, bytes);
    return {
      outputPath,
      alt: stringValue(
        config.alt ?? (isPreset ? `${presetTitle}. ${presetDescription}` : context.title),
        "metadata.image.alt",
      ),
    };
  }
  return {
    assets,
    async resolve(
      directory: DirectoryData,
      hrefForOutput: (outputPath: string) => string,
      pagePath: string,
    ): Promise<PageMetadata> {
      const relativePath = directory.current.relativePath;
      const context: MetadataContext = Object.freeze({
        site,
        directory: Object.freeze({
          ...countEntries(directory),
          relativePath,
          name: directory.current.name,
        }),
      });
      const title = stringValue(
        typeof options.title === "function"
          ? await options.title(context)
          : (options.title ?? (relativePath ? `${relativePath} · ${site.name}` : site.name)),
        "metadata.title",
      );
      const description = stringValue(
        typeof options.description === "function"
          ? await options.description(context)
          : (options.description ??
              (relativePath
                ? `Browse ${relativePath} in ${site.name}. This folder: ${describeContent(context.directory)}.`
                : `Browse files in ${site.name}. Archive totals: ${describeContent(site)}.`)),
        "metadata.description",
      );
      const image = await imageFor(Object.freeze({ ...context, title, description }));
      const meta = (key: string, value: string, property = false) =>
        `<meta data-dirwell-metadata ${property ? "property" : "name"}="${key}" content="${escapeHtml(value)}">`;
      let head = `<title>${escapeHtml(title)}</title>${meta("description", description)}${meta("og:title", title, true)}${meta("og:description", description, true)}${meta("og:type", "website", true)}`;
      if (siteUrl) {
        const canonical = new URL(pagePath.split("/").map(encodeURIComponent).join("/"), siteUrl)
          .href;
        head += `${meta("og:url", canonical, true)}<link data-dirwell-metadata rel="canonical" href="${escapeHtml(canonical)}">`;
      }
      if (image) {
        const href = siteUrl
          ? new URL(image.outputPath.split("/").map(encodeURIComponent).join("/"), siteUrl).href
          : hrefForOutput(image.outputPath);
        head +=
          meta("og:image", href, true) +
          meta("og:image:alt", image.alt, true) +
          meta("twitter:card", "summary_large_image") +
          meta("twitter:title", title) +
          meta("twitter:description", description) +
          meta("twitter:image", href) +
          meta("twitter:image:alt", image.alt);
      }
      return { title, description, head };
    },
  };
}
