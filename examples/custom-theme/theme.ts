import { readFile } from "node:fs/promises";
import { escapeHtml } from "../../src/index.ts";
import type { ExplorerTheme, FileSystemEntry, ThemeContext } from "../../src/index.ts";

const styles = await readFile(new URL("./theme.css", import.meta.url), "utf8");

function renderEntry(entry: FileSystemEntry, context: ThemeContext): string {
  const href = context.hrefFor(entry);
  const label = `${entry.name}${entry.kind === "directory" ? "/" : ""}`;
  const name =
    href === null
      ? `<span class="unavailable">${escapeHtml(label)}</span>`
      : `<a href="${escapeHtml(href)}"${context.exitsExplorerFor(entry) ? ' target="_blank" rel="noopener"' : ""}>${escapeHtml(label)}</a>`;
  const detail = entry.symlink?.isBroken
    ? "broken link"
    : entry.symlink?.isCycle
      ? "cycle"
      : entry.symlink?.isOutsideRoot
        ? "external link"
        : entry.kind === "directory"
          ? "collection"
          : entry.kind === "symlink"
            ? "link"
            : "download";
  return `<li data-kind="${escapeHtml(entry.kind)}">${name}<small>${detail}</small></li>`;
}

export const releaseCatalogTheme: ExplorerTheme = {
  name: "release-catalog",
  searchIndex: false,
  render(context) {
    const { directory } = context;
    const visiblePath = directory.current.relativePath || "/";
    const parentHref =
      directory.parent === null ? null : context.hrefForDirectory(directory.parent.relativePath);
    const parentLink =
      parentHref !== null
        ? `<a href="${escapeHtml(parentHref)}">Back to ${escapeHtml(directory.parent?.name || "home")}</a>`
        : "";
    const rows = directory.entries.map((entry) => renderEntry(entry, context)).join("");
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    ${context.documentBaseHref === null ? "" : `<base href="${escapeHtml(context.documentBaseHref)}">`}
    <title>${escapeHtml(visiblePath)} · Northstar releases</title>
    <link rel="stylesheet" href="${escapeHtml(context.assetHref("release-catalog.css"))}">
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">Northstar release catalog</p>
        <nav aria-label="Location">
          <a href="${escapeHtml(context.hrefForDirectory(""))}">Home</a>
          ${parentLink ? `<span aria-hidden="true">/</span>${parentLink}` : ""}
        </nav>
        <h1>${escapeHtml(visiblePath)}</h1>
        <p class="summary">${directory.entries.length} ${directory.entries.length === 1 ? "item" : "items"} in this collection</p>
      </header>
      <section aria-labelledby="contents">
        <h2 id="contents">Available files</h2>
        ${directory.entries.length === 0 ? "<p>This collection is empty.</p>" : `<ul>${rows}</ul>`}
      </section>
      <footer>Northstar release archive · Sample content</footer>
    </main>
  </body>
</html>`;
    return { html, assets: { "release-catalog.css": styles } };
  },
};
