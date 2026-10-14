import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { escapeHtml } from "@dirwell/core";
import type { ExplorerTheme } from "@dirwell/core";
import { createThemePage, folderDataHref, pageAsset } from "../../shared-theme/src/page.ts";
// Generated server component is paired with the separately compiled browser component.
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
export interface LedgerThemeOptions extends ThemeCustomization {
  readonly title?: string;
  readonly archiveSearch?: boolean;
}
export function createLedgerTheme(
  options: LedgerThemeOptions = {},
  renderer?: FrameworkRenderer,
): ExplorerTheme {
  assertThemeOptions(options, ["title", "archiveSearch"]);
  if (options.title !== undefined && (typeof options.title !== "string" || !options.title))
    throw new TypeError("title must be a non-empty string");
  if (options.archiveSearch !== undefined && typeof options.archiveSearch !== "boolean")
    throw new TypeError("archiveSearch must be a boolean");
  const ui = resolveCustomization(options);
  const publishedUi = pickCustomization(options);
  // Bundled resources are immutable for this theme instance; source rebuilds use a new instance.
  let resources: Promise<{ script: string; scriptName: string; styles: string }> | undefined;
  const loadResources = () =>
    (resources ??= Promise.all([
      renderer?.clientScript ?? readFile(new URL("./client.js", import.meta.url), "utf8"),
      readFile(new URL("./styles.css", import.meta.url), "utf8"),
    ]).then(([script, styles]) => ({
      script,
      styles,
      scriptName: `ledger-client-${createHash("sha256").update(script).digest("hex").slice(0, 16)}.js`,
    })));
  const theme: ExplorerTheme = {
    name: "ledger",
    searchIndex: options.archiveSearch ?? true,
    listing: { pagination: true },
    entryData: (entry, context) => ({ folderDataHref: folderDataHref(entry, context, "ledger") }),
    async render(context) {
      const model = {
        ...createThemePage(context, theme, options.title ?? ui.brand.name ?? "Dirwell"),
        ...(publishedUi === undefined ? {} : { ui: publishedUi }),
        searchIndexHref: theme.searchIndex === false ? null : context.searchIndexHref,
      };
      const { script, scriptName, styles } = await loadResources();
      const json = JSON.stringify(model).replaceAll("<", "\\u003c");
      return {
        html: `<!doctype html><html lang="${escapeHtml(ui.language)}" dir="${ui.direction}" data-theme="system"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${context.documentBaseHref === null ? "" : `<base href="${escapeHtml(context.documentBaseHref)}">`}${context.metadata?.head ?? `<title>${escapeHtml(model.title)}</title>`}${ui.brand.faviconUrl ? `<link rel="icon" href="${escapeHtml(ui.brand.faviconUrl)}">` : ""}<style>${styles}${renderer?.styles ?? ""}${customizationCss(ui)}</style></head><body><div data-dirwell-theme="ledger">${await (renderer?.renderBody ?? renderBody)(model)}</div><script type="application/json" id="dirwell-page-data">${json}</script><script ${renderer?.clientType === "module" ? 'type="module"' : "defer"} src="${escapeHtml(context.assetHref(scriptName))}"></script></body></html>`,
        assets: {
          [scriptName]: script,
          [pageAsset("ledger", model.path, model.page?.number ?? 1)]: JSON.stringify(model),
        },
      };
    },
  };
  return theme;
}
