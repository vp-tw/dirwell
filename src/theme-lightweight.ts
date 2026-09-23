import type { ExplorerTheme, FileSystemEntry, ThemeContext } from "./model.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function status(entry: FileSystemEntry): string {
  if (entry.symlink?.isBroken) return "broken link";
  if (entry.symlink?.isOutsideRoot) return "unavailable link";
  if (entry.symlink?.isCycle) return "cycle link";
  if (entry.kind === "symlink") return "link";
  if (entry.kind === "directory") return "folder";
  return "file";
}

function renderBreadcrumbs(context: ThemeContext): string {
  const segments = context.directory.current.relativePath.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  const ancestors = segments.slice(0, -1).map((segment, index) => {
    const relativePath = segments.slice(0, index + 1).join("/");
    return `<a href="${escapeHtml(context.hrefForDirectory(relativePath))}">${escapeHtml(segment)}</a>`;
  });
  return `<nav aria-label="Breadcrumb"><a href="${escapeHtml(context.hrefForDirectory(""))}">Home</a> / ${ancestors.length === 0 ? "" : `${ancestors.join(" / ")} / `}<span aria-current="page">${escapeHtml(segments.at(-1) ?? "")}</span></nav>`;
}

function renderEntry(entry: FileSystemEntry, context: ThemeContext): string {
  const directoryLike = entry.kind === "directory" || entry.symlink?.targetKind === "directory";
  const name = `${escapeHtml(entry.name)}${directoryLike ? "/" : ""}`;
  const href = context.hrefFor(entry);
  const exitsExplorer = context.exitsExplorerFor(entry);
  const link =
    href === null
      ? `<span>${name}</span>`
      : `<a href="${escapeHtml(href)}"${exitsExplorer ? ' target="_blank" rel="noopener"' : ""}>${name}</a>`;
  const details = [status(entry)];
  if (!directoryLike) details.push(`${entry.metadata.size} B`);
  if (entry.symlink !== null) details.push(`Target: ${entry.symlink.target}`);
  if (exitsExplorer) details.push("opens in a new tab");
  const modifiedAt = entry.metadata.times.modifiedAt;
  return `<li>${link}<small>${escapeHtml(details.join(" · "))} · <time datetime="${escapeHtml(modifiedAt)}">${escapeHtml(modifiedAt.slice(0, 16).replace("T", " "))} UTC</time></small></li>`;
}

/** A no-icon, no-script theme that leaves navigation and controls to the browser. */
export function createLightweightTheme(): ExplorerTheme {
  return {
    name: "lightweight",
    searchIndex: false,
    render(context) {
      const visiblePath =
        context.directory.current.relativePath === ""
          ? "/"
          : `/${context.directory.current.relativePath}/`;
      const parentHref =
        context.directory.parent === null
          ? null
          : context.hrefForDirectory(context.directory.parent.relativePath);
      const parentRow =
        parentHref === null ? "" : `<li><a href="${escapeHtml(parentHref)}">../</a></li>`;
      const rows = context.directory.entries.map((entry) => renderEntry(entry, context)).join("");
      const count = context.directory.entries.length;
      const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light">${context.documentBaseHref === null ? "" : `<base href="${escapeHtml(context.documentBaseHref)}">`}<title>Index of ${escapeHtml(visiblePath)}</title><style>body{max-width:72ch;margin:2rem auto;padding:0 1rem}h1,li,nav{overflow-wrap:anywhere}li{margin:.6rem 0}small{display:block}</style></head>
<body><main>${renderBreadcrumbs(context)}<h1>Index of ${escapeHtml(visiblePath)}</h1><p>${count} ${count === 1 ? "entry" : "entries"}</p>${count === 0 ? "<p>This directory is empty.</p>" : ""}<ul>${parentRow}${rows}</ul></main></body></html>`;
      return { html };
    },
  };
}
