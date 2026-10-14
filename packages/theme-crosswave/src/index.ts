import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { escapeHtml } from "@dirwell/core";
import type { ExplorerTheme } from "@dirwell/core";
import { createThemePage, folderDataHref, pageAsset } from "../../shared-theme/src/page.ts";
import {
  entryMimeType,
  entryCategories,
  resolveCrosswaveCategories,
  defaultCrosswaveCategories,
  type CrosswaveCategory,
} from "./categories.ts";
import type { FrameworkRenderer } from "./model.ts";
export type { FrameworkRenderer, ThemePage } from "./model.ts";
import { renderBody } from "../render-generated.mjs";
import {
  assertThemeOptions,
  resolveCustomization,
  customizationCss,
  pickCustomization,
  type ThemeCustomization,
} from "../../shared-theme/src/customization.ts";
export type {
  ThemeCustomization,
  ThemeLabels,
  ThemeColumn,
  ThemeAction,
} from "../../shared-theme/src/customization.ts";
export { defaultCrosswaveCategories } from "./categories.ts";
export type {
  CrosswaveCategory,
  CrosswaveCategoryMatch,
  CrosswaveCategoryIcon,
} from "./categories.ts";
export interface CrosswaveThemeOptions extends ThemeCustomization {
  readonly title?: string;
  readonly categories?: readonly CrosswaveCategory[];
  readonly color?: "azure" | "violet" | "amber" | "rose" | "jade" | "graphite";
  readonly gamepad?: boolean;
  readonly backgroundMotion?: boolean;
}
export function createCrosswaveTheme(
  options: CrosswaveThemeOptions = {},
  renderer?: FrameworkRenderer,
): ExplorerTheme {
  assertThemeOptions(options, ["title", "categories", "color", "gamepad", "backgroundMotion"]);
  if (options.title !== undefined && (typeof options.title !== "string" || !options.title))
    throw new TypeError("title must be a non-empty string");
  if (
    options.color !== undefined &&
    !["azure", "violet", "amber", "rose", "jade", "graphite"].includes(options.color)
  )
    throw new TypeError("Unsupported Crosswave color");
  for (const key of ["gamepad", "backgroundMotion"] as const)
    if (options[key] !== undefined && typeof options[key] !== "boolean")
      throw new TypeError(`${key} must be a boolean`);
  const ui = resolveCustomization(options);
  const publishedUi = pickCustomization(options);
  const categoryLabels: Readonly<Record<string, string>> = {
    all: ui.labels.allFiles,
    folder: ui.labels.categoryFolders,
    image: ui.labels.categoryPhotos,
    audio: ui.labels.categoryMusic,
    video: ui.labels.categoryVideos,
    document: ui.labels.categoryDocuments,
    other: ui.labels.categoryOther,
  };
  const categories = resolveCrosswaveCategories(
    options.categories ??
      defaultCrosswaveCategories.map((category) => ({
        ...category,
        label: categoryLabels[category.id] ?? category.label,
      })),
  );
  // Bundled resources are immutable for this theme instance; source rebuilds use a new instance.
  let resources: Promise<{ script: string; scriptName: string; styles: string }> | undefined;
  const loadResources = () =>
    (resources ??= Promise.all([
      renderer?.clientScript ?? readFile(new URL("./client.js", import.meta.url), "utf8"),
      readFile(new URL("./styles.css", import.meta.url), "utf8"),
    ]).then(([script, styles]) => ({
      script,
      styles,
      scriptName: `crosswave-client-${createHash("sha256").update(script).digest("hex").slice(0, 16)}.js`,
    })));
  const theme: ExplorerTheme = {
    name: "crosswave",
    searchIndex: false,
    listing: { pagination: true },
    entryData: (entry, context) => ({
      mimeType: entryMimeType(entry),
      categories: entryCategories(entry, entryMimeType(entry), categories).map((item) => item.id),
      folderDataHref: folderDataHref(entry, context, "crosswave"),
    }),
    async render(context) {
      const model = {
        ...createThemePage(context, theme, options.title ?? ui.brand.name ?? "Dirwell"),
        ...(publishedUi === undefined ? {} : { ui: publishedUi }),
        categories: categories.map(({ id, label, svg }) => ({ id, label, svg })),
        color: options.color ?? "azure",
        gamepad: options.gamepad ?? true,
        backgroundMotion: options.backgroundMotion ?? true,
      };
      const { script, scriptName, styles } = await loadResources();
      const json = JSON.stringify(model).replaceAll("<", "\\u003c");
      return {
        html: `<!doctype html><html lang="${escapeHtml(ui.language)}" dir="${ui.direction}" data-cw-color="${escapeHtml(model.color)}" data-cw-motion="${model.backgroundMotion}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${context.documentBaseHref === null ? "" : `<base href="${escapeHtml(context.documentBaseHref)}">`}${context.metadata?.head ?? `<title>${escapeHtml(model.title)}</title>`}${ui.brand.faviconUrl ? `<link rel="icon" href="${escapeHtml(ui.brand.faviconUrl)}">` : ""}<style>${styles}${renderer?.styles ?? ""}${customizationCss(ui)}</style></head><body><div data-dirwell-theme="crosswave">${await (renderer?.renderBody ?? renderBody)(model)}</div><script type="application/json" id="dirwell-page-data">${json}</script><script ${renderer?.clientType === "module" ? 'type="module"' : "defer"} src="${escapeHtml(context.assetHref(scriptName))}"></script></body></html>`,
        assets: {
          [scriptName]: script,
          [pageAsset("crosswave", model.path, model.page?.number ?? 1)]: JSON.stringify(model),
        },
      };
    },
  };
  return theme;
}
