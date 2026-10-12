import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { escapeHtml } from "@dirwell/core";
import type { ExplorerTheme } from "@dirwell/core";
import { createThemePage, folderDataHref, pageAsset } from "../../shared-theme/src/page.ts";
// Generated server component is paired with the separately compiled browser component.
import { renderBody } from "../render-generated.mjs";
export interface LedgerThemeOptions {
  readonly title?: string;
}
export function createLedgerTheme(options: LedgerThemeOptions = {}): ExplorerTheme {
  const theme: ExplorerTheme = {
    name: "ledger",
    listing: { pagination: true },
    entryData: (entry, context) => ({ folderDataHref: folderDataHref(entry, context, "ledger") }),
    async render(context) {
      const model = {
        ...createThemePage(context, theme, options.title ?? "Dirwell"),
        searchIndexHref: context.searchIndexHref,
      };
      const script = await readFile(new URL("./client.js", import.meta.url), "utf8");
      const scriptName = `ledger-client-${createHash("sha256").update(script).digest("hex").slice(0, 16)}.js`;
      const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");
      const json = JSON.stringify(model).replaceAll("<", "\\u003c");
      return {
        html: `<!doctype html><html lang="en" data-theme="system"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${context.documentBaseHref === null ? "" : `<base href="${escapeHtml(context.documentBaseHref)}">`}${context.metadata?.head ?? `<title>${escapeHtml(model.title)}</title>`}<style>${styles}</style></head><body><div data-dirwell-theme="ledger">${await renderBody(model)}</div><script type="application/json" id="dirwell-page-data">${json}</script><script defer src="${escapeHtml(context.assetHref(scriptName))}"></script></body></html>`,
        assets: {
          [scriptName]: script,
          [pageAsset("ledger", model.path, model.page?.number ?? 1)]: JSON.stringify(model),
        },
      };
    },
  };
  return theme;
}
