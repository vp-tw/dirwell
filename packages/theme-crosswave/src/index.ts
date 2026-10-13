import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { escapeHtml } from "@dirwell/core";
import type { ExplorerTheme } from "@dirwell/core";
import { createThemePage, folderDataHref, pageAsset } from "../../shared-theme/src/page.ts";
import {
  entryMimeType,
  entryCategories,
  resolveCrosswaveCategories,
  type CrosswaveCategory,
} from "./categories.ts";
import type { FrameworkRenderer } from "./model.ts";
export type { FrameworkRenderer, ThemePage } from "./model.ts";
import { renderBody } from "../render-generated.mjs";
export { defaultCrosswaveCategories } from "./categories.ts";
export type {
  CrosswaveCategory,
  CrosswaveCategoryMatch,
  CrosswaveCategoryIcon,
} from "./categories.ts";
export interface CrosswaveThemeOptions {
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
  const categories = resolveCrosswaveCategories(options.categories);
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
        ...createThemePage(context, theme, options.title ?? "Dirwell"),
        categories: categories.map(({ id, label, svg }) => ({ id, label, svg })),
        color: options.color ?? "azure",
        gamepad: options.gamepad ?? true,
        backgroundMotion: options.backgroundMotion ?? true,
      };
      const script =
          renderer?.clientScript ??
          (await readFile(new URL("./client.js", import.meta.url), "utf8")),
        styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");
      const scriptName = `crosswave-client-${createHash("sha256").update(script).digest("hex").slice(0, 16)}.js`;
      const json = JSON.stringify(model).replaceAll("<", "\\u003c");
      return {
        html: `<!doctype html><html lang="en" data-cw-color="${escapeHtml(model.color)}" data-cw-motion="${model.backgroundMotion}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${context.documentBaseHref === null ? "" : `<base href="${escapeHtml(context.documentBaseHref)}">`}${context.metadata?.head ?? `<title>${escapeHtml(model.title)}</title>`}<style>${styles}${renderer?.styles ?? ""}</style></head><body><div data-dirwell-theme="crosswave">${await (renderer?.renderBody ?? renderBody)(model)}</div><script type="application/json" id="dirwell-page-data">${json}</script><script ${renderer?.clientType === "module" ? 'type="module"' : "defer"} src="${escapeHtml(context.assetHref(scriptName))}"></script></body></html>`,
        assets: {
          [scriptName]: script,
          [pageAsset("crosswave", model.path, model.page?.number ?? 1)]: JSON.stringify(model),
        },
      };
    },
  };
  return theme;
}
