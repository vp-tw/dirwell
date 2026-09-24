import { createHash } from "node:crypto";
import type { FileSystemEntry } from "../model.ts";
import { vscodeIconAssetName, vscodeIconsByExtension } from "./vscode-icons.ts";

export interface DefaultThemeIconVariant {
  /** SVG markup for entries without a matching extension. */
  readonly file: string;
  /** SVG markup for directories. */
  readonly folder: string;
  /** SVG markup keyed by lowercase file extension, without the leading dot. */
  readonly byExtension?: Readonly<Record<string, string>>;
}

export interface DefaultThemeIconSet {
  readonly light: DefaultThemeIconVariant;
  /** Omit to use the light icons in both color schemes. */
  readonly dark?: DefaultThemeIconVariant;
  /** Optional attribution included in generated sites and linked from the footer. */
  readonly notice?: string;
}

export interface ResolvedIconVariant {
  readonly file: string;
  readonly folder: string;
  readonly byExtension: Readonly<Record<string, string>>;
}

export interface ResolvedIconSet {
  readonly light: ResolvedIconVariant;
  readonly dark?: ResolvedIconVariant;
}

export interface PreparedIconSet {
  readonly assets: Readonly<Record<string, string>>;
  readonly names: ResolvedIconSet;
  readonly noticeName?: string;
}

function assetName(svg: string): string {
  return `theme-icon-${createHash("sha256").update(svg).digest("hex")}.svg`;
}

function prepareVariant(
  variant: DefaultThemeIconVariant,
  assets: Record<string, string>,
): ResolvedIconVariant {
  const add = (svg: string): string => {
    if (typeof svg !== "string" || !/^\s*<svg\b/.test(svg)) {
      throw new TypeError("Theme icons must be SVG markup");
    }
    const name = assetName(svg);
    assets[name] = svg;
    return name;
  };
  const byExtension = Object.fromEntries(
    Object.entries(variant.byExtension ?? {}).map(([extension, svg]) => {
      if (!/^[a-z0-9][a-z0-9+_-]*$/.test(extension)) {
        throw new TypeError(`Invalid icon extension: ${extension}`);
      }
      return [extension, add(svg)];
    }),
  );
  return { file: add(variant.file), folder: add(variant.folder), byExtension };
}

export function prepareIconSet(
  icons: DefaultThemeIconSet | undefined,
  vscodeIconAssets: Readonly<Record<string, string>>,
  vscodeIconNotice: string,
): PreparedIconSet {
  if (icons === undefined) {
    return {
      assets: { ...vscodeIconAssets, "vscode-icons-NOTICE.txt": vscodeIconNotice },
      names: {
        light: {
          file: vscodeIconAssetName("default_file"),
          folder: vscodeIconAssetName("default_folder"),
          byExtension: Object.fromEntries(
            Object.entries(vscodeIconsByExtension).map(([extension, name]) => [
              extension,
              vscodeIconAssetName(name),
            ]),
          ),
        },
      },
      noticeName: "vscode-icons-NOTICE.txt",
    };
  }
  if (
    icons.notice !== undefined &&
    (typeof icons.notice !== "string" || icons.notice.trim() === "")
  ) {
    throw new TypeError("Theme icon attribution notice must be non-empty text");
  }
  const assets: Record<string, string> =
    icons.notice === undefined ? {} : { "theme-icons-NOTICE.txt": icons.notice };
  const light = prepareVariant(icons.light, assets);
  const dark = icons.dark === undefined ? undefined : prepareVariant(icons.dark, assets);
  return {
    assets,
    names: { light, ...(dark === undefined ? {} : { dark }) },
    ...(icons.notice === undefined ? {} : { noticeName: "theme-icons-NOTICE.txt" }),
  };
}

export function iconNameForEntry(entry: FileSystemEntry, variant: ResolvedIconVariant): string {
  if (entry.kind === "directory" || entry.symlink?.targetKind === "directory") {
    return variant.folder;
  }
  const extension = entry.name.slice(entry.name.lastIndexOf(".") + 1).toLowerCase();
  return Object.hasOwn(variant.byExtension, extension)
    ? variant.byExtension[extension]!
    : variant.file;
}

export function iconHrefs(
  names: ResolvedIconSet,
  assetHref: (assetName: string) => string,
): ResolvedIconSet {
  const resolve = (variant: ResolvedIconVariant): ResolvedIconVariant => ({
    file: assetHref(variant.file),
    folder: assetHref(variant.folder),
    byExtension: Object.fromEntries(
      Object.entries(variant.byExtension).map(([extension, name]) => [extension, assetHref(name)]),
    ),
  });
  return {
    light: resolve(names.light),
    ...(names.dark === undefined ? {} : { dark: resolve(names.dark) }),
  };
}
