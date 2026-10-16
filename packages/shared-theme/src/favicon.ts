import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml } from "../../core/src/html.ts";
import type { ThemeContext } from "@dirwell/core";
import type { ThemeCustomization } from "./customization.ts";
import type { FaviconDescriptor } from "./favicon-options.ts";

interface ThemeFavicons {
  readonly head: string;
  readonly assets: Readonly<Record<string, Uint8Array>>;
}
type IconAttributes = Pick<FaviconDescriptor, "type" | "sizes" | "media">;
type NormalizedIcon = IconAttributes &
  ({ readonly href: string } | { readonly source: File | string; readonly type: string });
type LoadedIcon = IconAttributes &
  ({ readonly href: string } | { readonly name: string; readonly bytes: Uint8Array });
const extensions: Readonly<Record<string, string>> = {
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
};
const mimeTypes: Readonly<Record<string, string>> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/vnd.microsoft.icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
};
function hasControlCharacters(value: string): boolean {
  return [...value].some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  );
}
function publicHref(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\\") ||
    /\s/.test(value) ||
    hasControlCharacters(value)
  )
    throw new TypeError("brand.favicon href must be an HTTP(S) or root-relative URL");
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    if (/^https?:\/\//i.test(value) && ["http:", "https:"].includes(new URL(value).protocol))
      return value;
  } catch {
    // Report the same actionable error for malformed and unsupported URLs.
  }
  throw new TypeError("brand.favicon href must be an HTTP(S) or root-relative URL");
}
function normalizeIcon(value: FaviconDescriptor): NormalizedIcon {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).some((key) => !["source", "href", "type", "sizes", "media"].includes(key)) ||
    Object.hasOwn(value, "source") === Object.hasOwn(value, "href")
  )
    throw new TypeError("brand.favicon requires exactly one source or href per icon");
  for (const key of ["type", "sizes", "media"] as const)
    if (
      value[key] !== undefined &&
      (typeof value[key] !== "string" || !value[key] || hasControlCharacters(value[key]))
    )
      throw new TypeError(
        `brand.favicon ${key} must be a non-empty string without control characters`,
      );
  if (value.type !== undefined && !Object.hasOwn(extensions, value.type))
    throw new TypeError("brand.favicon type must be a supported image MIME type");
  if (
    value.sizes !== undefined &&
    !/^(?:any|[1-9]\d*x[1-9]\d*(?: [1-9]\d*x[1-9]\d*)*)$/.test(value.sizes)
  )
    throw new TypeError("brand.favicon sizes must be any or space-separated positive WxH sizes");
  const attributes = {
    ...(value.type === undefined ? {} : { type: value.type }),
    ...(value.sizes === undefined ? {} : { sizes: value.sizes }),
    ...(value.media === undefined ? {} : { media: value.media }),
  };
  if (Object.hasOwn(value, "href")) return { ...attributes, href: publicHref(value.href) };
  let source: File | string;
  const input = value.source;
  if (input instanceof File) source = input;
  else if (input instanceof URL) {
    if (input.protocol !== "file:" || input.search || input.hash)
      throw new TypeError("brand.favicon source URL must be a file URL without query or fragment");
    source = fileURLToPath(input);
  } else if (
    typeof input === "string" &&
    input &&
    !input.includes("\0") &&
    (!/^[a-z][a-z\d+.-]*:/i.test(input) || /^[a-z]:[\\/]/i.test(input))
  )
    source = resolve(input);
  else
    throw new TypeError(
      "brand.favicon source must be a File, local path, or file URL; use href for public URLs",
    );
  const type =
    value.type ??
    (source instanceof File && source.type
      ? source.type
      : mimeTypes[extname(source instanceof File ? source.name : source).toLowerCase()]);
  if (type === undefined || !Object.hasOwn(extensions, type))
    throw new TypeError("brand.favicon source needs a supported image extension or explicit type");
  return {
    ...attributes,
    source,
    type,
    ...(value.sizes === undefined && type === "image/svg+xml" ? { sizes: "any" } : {}),
  };
}

/** Snapshot options now; read image bytes once, on the first render. */
export function createThemeFavicons(brand: ThemeCustomization["brand"], directory?: URL) {
  if (brand?.favicon !== undefined && brand.faviconUrl !== undefined)
    throw new TypeError("Configure only one of brand.favicon and brand.faviconUrl");
  const input =
    brand?.favicon !== undefined
      ? brand.favicon
      : brand?.faviconUrl === undefined
        ? undefined
        : brand.faviconUrl === false
          ? false
          : { href: brand.faviconUrl };
  const descriptors =
    input === false
      ? []
      : input === undefined
        ? directory === undefined
          ? []
          : [16, 32, 48].map((size) => ({
              source: new URL(`favicon-${size}.png`, directory),
              sizes: `${size}x${size}`,
            }))
        : Array.isArray(input)
          ? Array.from(input)
          : [input];
  if (input !== undefined && input !== false && descriptors.length === 0)
    throw new TypeError("brand.favicon must contain at least one icon; use false to disable it");
  const icons = descriptors.map(normalizeIcon);
  let loaded: Promise<readonly LoadedIcon[]> | undefined;
  return async (assetHref: ThemeContext["assetHref"]): Promise<ThemeFavicons> => {
    loaded ??= Promise.all(
      icons.map(async (icon) => {
        if ("href" in icon) return icon;
        let bytes: Uint8Array;
        try {
          bytes =
            icon.source instanceof File
              ? new Uint8Array(await icon.source.arrayBuffer())
              : await readFile(icon.source);
        } catch (cause) {
          throw new Error("Could not read brand.favicon source", { cause });
        }
        const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
        return { ...icon, bytes, name: `dirwell-favicon-${hash}${extensions[icon.type]}` };
      }),
    );
    const resolved = await loaded;
    const assets: Record<string, Uint8Array> = {};
    const head = resolved
      .map((icon) => {
        if ("name" in icon) assets[icon.name] = icon.bytes;
        const href = "href" in icon ? icon.href : assetHref(icon.name);
        const attributes = (["type", "sizes", "media"] as const)
          .map((key) => {
            const value = icon[key];
            return value === undefined ? "" : ` ${key}="${escapeHtml(value)}"`;
          })
          .join("");
        return `<link rel="icon" href="${escapeHtml(href)}"${attributes} data-dirwell-metadata>`;
      })
      .join("");
    return { head, assets };
  };
}
