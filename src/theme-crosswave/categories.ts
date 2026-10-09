import mime from "mime";
import type { FileSystemEntry } from "../model.ts";
import { crosswaveIcon, type CrosswaveIcon } from "./icons.ts";

export type CrosswaveCategoryIcon = CrosswaveIcon | { readonly svg: string };
export type CrosswaveCategoryMatch =
  | "all"
  | "folders"
  | "other"
  | { readonly extensions?: readonly string[]; readonly mimeTypes?: readonly string[] };
export interface CrosswaveCategory {
  readonly id: string;
  readonly label: string;
  readonly icon?: CrosswaveCategoryIcon;
  readonly match: CrosswaveCategoryMatch;
}
export interface ResolvedCrosswaveCategory {
  readonly id: string;
  readonly label: string;
  readonly svg: string;
  readonly match: CrosswaveCategoryMatch;
}
const documents = [
  "text/*",
  "application/pdf",
  "application/json",
  "application/*+json",
  "application/xml",
  "application/*+xml",
  "application/msword",
  "application/rtf",
  "application/sql",
  "application/epub+zip",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;
const definitions: readonly CrosswaveCategory[] = [
  { id: "all", label: "All files", icon: "all", match: "all" },
  { id: "folder", label: "Folders", icon: "folder", match: "folders" },
  { id: "image", label: "Photos", icon: "image", match: { mimeTypes: ["image/*"] } },
  {
    id: "audio",
    label: "Music",
    icon: "audio",
    match: { mimeTypes: ["audio/*", "application/vnd.apple.mpegurl"] },
  },
  { id: "video", label: "Videos", icon: "video", match: { mimeTypes: ["video/*"] } },
  { id: "document", label: "Documents", icon: "document", match: { mimeTypes: documents } },
  { id: "other", label: "Other", icon: "other", match: "other" },
];
/** Default rail definitions. Supply a mapped/filtered copy to change labels, order, or visibility. */
export const defaultCrosswaveCategories: readonly CrosswaveCategory[] = Object.freeze(
  definitions.map((category) =>
    Object.freeze({
      ...category,
      match:
        typeof category.match === "string"
          ? category.match
          : Object.freeze({
              ...(category.match.extensions
                ? { extensions: Object.freeze([...category.match.extensions]) }
                : {}),
              ...(category.match.mimeTypes
                ? { mimeTypes: Object.freeze([...category.match.mimeTypes]) }
                : {}),
            }),
    }),
  ),
);
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
function strings(
  value: unknown,
  normalize: (value: string) => string,
): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value))
    throw new TypeError("Crosswave category rules must be arrays of strings");
  return Object.freeze([
    ...new Set(
      Array.from(value, (item: unknown) => {
        if (typeof item !== "string")
          throw new TypeError("Crosswave category rules must be arrays of strings");
        return normalize(item);
      }),
    ),
  ]);
}
function extension(value: string): string {
  const normalized = value.toLowerCase().replace(/^\./, "");
  if (!/^[a-z0-9+_-]+(?:\.[a-z0-9+_-]+)*$/.test(normalized))
    throw new TypeError(`Invalid Crosswave extension: ${value}`);
  return normalized;
}
function mediaType(value: string): string {
  const normalized = value.toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/(?:[a-z0-9!#$&^_.+-]+|\*|\*\+[a-z0-9!#$&^_.-]+)$/.test(normalized))
    throw new TypeError(`Invalid Crosswave MIME pattern: ${value}`);
  return normalized;
}
function match(value: unknown): CrosswaveCategoryMatch {
  if (value === "all" || value === "folders" || value === "other") return value;
  if (
    !record(value) ||
    Object.keys(value).some((key) => !["extensions", "mimeTypes"].includes(key))
  )
    throw new TypeError("Crosswave match must be all, folders, other, or extension/MIME rules");
  const extensions = strings(value.extensions, extension);
  const mimeTypes = strings(value.mimeTypes, mediaType);
  if (!extensions?.length && !mimeTypes?.length)
    throw new TypeError("Crosswave category needs at least one matching rule");
  return Object.freeze({
    ...(extensions ? { extensions } : {}),
    ...(mimeTypes ? { mimeTypes } : {}),
  });
}
function icon(value: unknown, rule: CrosswaveCategoryMatch): string {
  if (value === undefined)
    return crosswaveIcon(rule === "all" ? "all" : rule === "folders" ? "folder" : "other");
  if (typeof value === "string" && isCrosswaveIcon(value)) return crosswaveIcon(value);
  if (
    record(value) &&
    typeof value.svg === "string" &&
    /^\s*<svg\b/i.test(value.svg) &&
    /<\/svg>\s*$/i.test(value.svg)
  )
    return value.svg.replace(/<svg\b/i, '<svg aria-hidden="true"');
  throw new TypeError("Crosswave icon must be a built-in icon name or trusted SVG markup");
}
function isCrosswaveIcon(value: string): value is CrosswaveIcon {
  return [
    "all",
    "folder",
    "image",
    "audio",
    "video",
    "document",
    "other",
    "link",
    "back",
    "search",
    "pause",
    "play",
    "controller",
  ].includes(value);
}
export function resolveCrosswaveCategories(value: unknown): readonly ResolvedCrosswaveCategory[] {
  const input = value === undefined ? defaultCrosswaveCategories : value;
  if (!Array.isArray(input) || !input.length)
    throw new TypeError("Crosswave categories must be a nonempty array");
  const ids = new Set<string>();
  return Object.freeze(
    Array.from(input).map((category: unknown) => {
      if (
        !record(category) ||
        typeof category.id !== "string" ||
        !/^[a-z][a-z0-9_-]{0,63}$/.test(category.id)
      )
        throw new TypeError("Crosswave category id must be a lowercase identifier");
      if (ids.has(category.id))
        throw new TypeError(`Duplicate Crosswave category id: ${category.id}`);
      ids.add(category.id);
      if (typeof category.label !== "string" || !category.label.trim())
        throw new TypeError("Crosswave category label must be nonempty");
      const rule = match(category.match);
      return Object.freeze({
        id: category.id,
        label: category.label,
        svg: icon(category.icon, rule),
        match: rule,
      });
    }),
  );
}
export function matchesMimeType(pattern: string, type: string): boolean {
  if (pattern === type) return true;
  const [group, subtype] = pattern.split("/");
  if (!subtype || !type.startsWith(`${group}/`)) return false;
  return subtype === "*" || (subtype.startsWith("*+") && type.endsWith(subtype.slice(1)));
}
export function entryMimeType(entry: FileSystemEntry): string | null {
  if (entry.kind === "directory" || entry.symlink?.targetKind === "directory") return null;
  return (
    mime.getType(entry.name) ??
    (entry.symlink?.targetKind === "file" &&
    !entry.symlink.isBroken &&
    !entry.symlink.isOutsideRoot &&
    !entry.symlink.isTargetExcluded &&
    entry.symlink.targetRelativePath
      ? mime.getType(entry.symlink.targetRelativePath)
      : null)
  );
}
export function entryCategory(entry: FileSystemEntry, type: string | null): CrosswaveIcon {
  if (entry.kind === "directory" || entry.symlink?.targetKind === "directory") return "folder";
  if (type?.startsWith("image/")) return "image";
  if (type?.startsWith("audio/") || type === "application/vnd.apple.mpegurl") return "audio";
  if (type?.startsWith("video/")) return "video";
  if (type && documents.some((pattern) => matchesMimeType(pattern, type))) return "document";
  return "other";
}
export function entryCategories(
  entry: FileSystemEntry,
  type: string | null,
  categories: readonly ResolvedCrosswaveCategory[],
): readonly ResolvedCrosswaveCategory[] {
  const folder = entry.kind === "directory" || entry.symlink?.targetKind === "directory";
  const filename = entry.name.toLowerCase();
  const specific = categories.filter(
    (category) =>
      typeof category.match !== "string" &&
      !folder &&
      (category.match.extensions?.some((ext) => filename.endsWith(`.${ext}`)) ||
        (type && category.match.mimeTypes?.some((pattern) => matchesMimeType(pattern, type)))),
  );
  return categories.filter(
    (category) =>
      category.match === "all" ||
      (folder && category.match === "folders") ||
      (!folder && category.match === "other" && !specific.length) ||
      specific.includes(category),
  );
}
