import { escapeHtml } from "./html.ts";
import type { ExplorerTheme, FileSystemEntry, ThemeContext } from "../../core/src/model.ts";
import { resolveThemeProject, type ThemeProjectOptions } from "./theme-project.ts";
import { utcTimestamp } from "./timestamp.ts";

export interface PlainThemeOptions {
  readonly project?: ThemeProjectOptions;
  /** Use explicit generated HTML filenames for no-script file-URL navigation. */
  readonly portableLinks?: boolean;
}

function externalHref(value: string | undefined): string | null {
  if (value === undefined) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function externalLink(label: string, href: string | null): string {
  return href === null
    ? escapeHtml(label)
    : `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
}

function status(entry: FileSystemEntry): string {
  if (entry.symlink?.isBroken) return "broken link";
  if (entry.symlink?.isOutsideRoot) return "unavailable link";
  if (entry.symlink?.isCycle) return "cycle link";
  if (entry.kind === "symlink") return "link";
  if (entry.kind === "directory") return "folder";
  return "file";
}

function renderBreadcrumbs(context: ThemeContext, directoryHref: (path: string) => string): string {
  const segments = context.directory.current.relativePath.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  const ancestors = segments.slice(0, -1).map((segment, index) => {
    const relativePath = segments.slice(0, index + 1).join("/");
    return `<a href="${escapeHtml(directoryHref(relativePath))}">${escapeHtml(segment)}</a>`;
  });
  return `<nav aria-label="Breadcrumb"><a href="${escapeHtml(directoryHref(""))}">Home</a> / ${ancestors.length === 0 ? "" : `${ancestors.join(" / ")} / `}<span aria-current="page">${escapeHtml(segments.at(-1) ?? "")}</span></nav>`;
}

function renderEntry(
  entry: FileSystemEntry,
  context: ThemeContext,
  portableLinks: boolean,
): string {
  const directoryLike = entry.kind === "directory" || entry.symlink?.targetKind === "directory";
  const name = `${escapeHtml(entry.name)}${directoryLike ? "/" : ""}`;
  const prepared = context.hrefFor(entry);
  const exitsExplorer = context.exitsExplorerFor(entry);
  const href =
    portableLinks && directoryLike && !exitsExplorer && prepared?.endsWith("/")
      ? `${prepared}index.html`
      : prepared;
  const link =
    href === null
      ? `<span>${name}</span>`
      : `<a href="${escapeHtml(href)}"${exitsExplorer ? ' target="_blank" rel="noopener"' : ""}>${name}</a>`;
  const details = [status(entry)];
  if (!directoryLike) details.push(`${entry.metadata.size} B`);
  if (entry.symlink !== null) details.push(`Target: ${entry.symlink.target}`);
  if (exitsExplorer) details.push("opens in a new tab");
  const modified = utcTimestamp(entry.metadata.times.modifiedAt);
  return `<li>${link}<small>${escapeHtml(details.join(" · "))} · ${modified === null ? "Unknown" : `<time datetime="${modified.datetime}">${modified.label}</time>`}</small></li>`;
}

/** A no-icon, no-script theme that leaves navigation and controls to the browser. */
export function createPlainTheme(options: PlainThemeOptions = {}): ExplorerTheme {
  const portableLinks = options.portableLinks ?? true;
  if (typeof portableLinks !== "boolean") throw new TypeError("portableLinks must be a boolean");
  const directoryHref = (context: ThemeContext, relativePath: string) => {
    const href = context.hrefForDirectory(relativePath);
    return portableLinks &&
      context.hasPageForDirectory?.(relativePath) === true &&
      href.endsWith("/")
      ? `${href}index.html`
      : href;
  };
  const project = resolveThemeProject(options.project);
  const repositoryHref = externalHref(project.repositoryUrl);
  const licenseHref = externalHref(
    options.project?.licenseUrl ??
      (options.project?.license === undefined ? "https://opensource.org/license/mit" : undefined),
  );
  return {
    name: "plain",
    listing: { pagination: true },
    metadataDefaults: {
      siteName: project.name,
      repositoryName: repositoryName(project.repositoryUrl),
      enabledByDefault: false,
    },
    searchIndex: false,
    render(context) {
      const visiblePath =
        context.directory.current.relativePath === ""
          ? "/"
          : `/${context.directory.current.relativePath}/`;
      const parentHref =
        context.directory.parent === null
          ? null
          : directoryHref(context, context.directory.parent.relativePath);
      const parentRow =
        parentHref === null ? "" : `<li><a href="${escapeHtml(parentHref)}">../</a></li>`;
      const rows = context.directory.entries
        .map((entry) => renderEntry(entry, context, portableLinks))
        .join("");
      const count = context.directory.entries.length;
      const page = context.listing?.page;
      const pagination =
        page === undefined || page.count === 1
          ? ""
          : `<nav aria-label="Pagination">${page.previousHref === null ? "" : `<a rel="prev" href="${escapeHtml(page.previousHref)}">Previous</a> · `}Page ${page.number} of ${page.count}${page.nextHref === null ? "" : ` · <a rel="next" href="${escapeHtml(page.nextHref)}">Next</a>`}</nav>`;
      const countLabel =
        page === undefined || page.count === 1
          ? `${count} ${count === 1 ? "entry" : "entries"}`
          : `${page.total} entries · ${count} on this page`;
      const fallbackTitle =
        options.project?.name === undefined
          ? `Index of ${visiblePath}`
          : context.directory.current.relativePath
            ? `${context.directory.current.relativePath} · ${project.name}`
            : project.name;
      const footer =
        options.project === undefined
          ? ""
          : `<footer><hr><p>Repository: ${externalLink(project.name, repositoryHref)} by ${escapeHtml(project.author)} · ${externalLink(project.license, licenseHref)}</p></footer>`;
      const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${context.documentBaseHref === null ? "" : `<base href="${escapeHtml(context.documentBaseHref)}">`}${context.metadata?.head ?? `<title>${escapeHtml(fallbackTitle)}${page === undefined || page.count === 1 ? "" : ` · page ${page.number}`}</title>`}<style>:root{color-scheme:light dark}body{max-width:72ch;margin:2rem auto;padding:0 1rem}h1,li,nav{overflow-wrap:anywhere}li{margin:.6rem 0}small{display:block}</style></head>
<body><main>${renderBreadcrumbs(context, (path) => directoryHref(context, path))}<h1>Index of ${escapeHtml(visiblePath)}</h1><p>${countLabel}</p>${pagination}${count === 0 ? "<p>This directory is empty.</p>" : ""}<ul>${parentRow}${rows}</ul>${pagination}</main>${footer}</body></html>`;
      return { html };
    },
  };
}

function repositoryName(repositoryUrl: string): string {
  try {
    return new URL(repositoryUrl).pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
  } catch {
    return repositoryUrl;
  }
}
