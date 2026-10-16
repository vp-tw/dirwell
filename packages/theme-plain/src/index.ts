import { renderSize } from "../../shared-theme/src/size.ts";
import { escapeHtml } from "./html.ts";
import type { ExplorerTheme, FileSystemEntry, ThemeContext } from "../../core/src/model.ts";
import { resolveThemeProject, type ThemeProjectOptions } from "./theme-project.ts";
import { utcTimestamp } from "./timestamp.ts";
import { projectListingEntry, type ListingEntry } from "../../core/src/listing.ts";
export type { ExplorerTheme } from "../../core/src/model.ts";
export type { ListingEntry } from "../../core/src/listing.ts";
import {
  assertThemeOptions,
  resolveCustomization,
  customizationCss,
  label,
  formattedDate,
  publicDataValue,
  type ThemeCustomization,
  type ResolvedThemeCustomization,
} from "../../shared-theme/src/customization.ts";
export type {
  ThemeCustomization,
  SizeDisplayOptions,
  ThemeLabels,
  ThemeColumn,
  ThemeAction,
} from "../../shared-theme/src/customization.ts";

export interface PlainThemeOptions extends ThemeCustomization {
  readonly project?: ThemeProjectOptions;
  readonly renderEntry?: (entry: ListingEntry) => string;
  /** Trusted markup outside the primary link; callers own any interactive behavior. */
  readonly renderEntryActions?: (entry: ListingEntry) => string;
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

function status(entry: FileSystemEntry, ui: ResolvedThemeCustomization): string {
  if (entry.symlink?.isBroken) return ui.labels.brokenLink;
  if (entry.symlink?.isOutsideRoot) return ui.labels.unavailableLink;
  if (entry.symlink?.isCycle) return ui.labels.cycleLink;
  if (entry.kind === "symlink") return ui.labels.link;
  if (entry.kind === "directory") return ui.labels.folder;
  return ui.labels.file;
}

function renderBreadcrumbs(
  context: ThemeContext,
  directoryHref: (path: string) => string | null,
  ui: ResolvedThemeCustomization,
): string {
  const segments = context.directory.current.relativePath.split("/").filter(Boolean);
  if (segments.length === 0) return "";
  const ancestors = segments.slice(0, -1).map((segment, index) => {
    const relativePath = segments.slice(0, index + 1).join("/");
    const href = directoryHref(relativePath);
    return href === null
      ? `<span>${escapeHtml(segment)}</span>`
      : `<a href="${escapeHtml(href)}">${escapeHtml(segment)}</a>`;
  });
  const home = directoryHref("");
  return `<nav aria-label="${escapeHtml(ui.labels.breadcrumb)}">${home === null ? `<span>${escapeHtml(ui.labels.home)}</span>` : `<a href="${escapeHtml(home)}">${escapeHtml(ui.labels.home)}</a>`} / ${ancestors.length === 0 ? "" : `${ancestors.join(" / ")} / `}<span aria-current="page">${escapeHtml(segments.at(-1) ?? "")}</span></nav>`;
}

function renderEntry(
  entry: FileSystemEntry,
  context: ThemeContext,
  options: PlainThemeOptions,
  ui: ResolvedThemeCustomization,
): string {
  const directoryLike = entry.kind === "directory" || entry.symlink?.targetKind === "directory";
  const record = projectListingEntry(entry, context);
  const name =
    options.renderEntry?.(record) ?? `${escapeHtml(entry.name)}${directoryLike ? "/" : ""}`;
  if (typeof name !== "string") throw new TypeError("renderEntry must return a string");
  const href = context.hrefFor(entry);
  const exitsExplorer = context.exitsExplorerFor(entry);
  const link =
    href === null
      ? `<span>${name}</span>`
      : `<a href="${escapeHtml(href)}"${exitsExplorer ? ' target="_blank" rel="noopener"' : ""}>${name}</a>`;
  const details = [status(entry, ui)];

  if (entry.symlink !== null) details.push(`${ui.labels.target}: ${entry.symlink.target}`);
  if (exitsExplorer) details.push(ui.labels.newTab);
  const modified = utcTimestamp(entry.metadata.times.modifiedAt);
  const columns = ui.columns
    .map((column) =>
      column === "name"
        ? link
        : column === "size"
          ? renderSize(record, ui)
          : column === "modified"
            ? modified === null
              ? escapeHtml(ui.labels.unknown)
              : `<time datetime="${modified.datetime}">${escapeHtml(options.locale !== undefined || options.timeZone !== undefined ? formattedDate(modified.datetime, ui) : modified.label)}</time>`
            : typeof column === "object"
              ? `${escapeHtml(column.label)}: ${escapeHtml(publicDataValue(record.data?.[column.dataKey]))}`
              : "",
    )
    .filter(Boolean);
  const customActions = options.renderEntryActions?.(record) ?? "";
  if (typeof customActions !== "string")
    throw new TypeError("renderEntryActions must return a string");
  const download =
    ui.actions.includes("download") &&
    href !== null &&
    !directoryLike &&
    !entry.symlink?.isBroken &&
    !entry.symlink?.isOutsideRoot &&
    !entry.symlink?.isTargetExcluded
      ? `<a download href="${escapeHtml(href)}">${escapeHtml(ui.labels.download)}</a>`
      : "";
  const time =
    modified === null
      ? escapeHtml(ui.labels.unknown)
      : `<time datetime="${modified.datetime}">${escapeHtml(options.locale !== undefined || options.timeZone !== undefined ? formattedDate(modified.datetime, ui) : modified.label)}</time>`;
  const content =
    options.columns === undefined
      ? `${link}${entry.kind === "directory" ? "" : `<div class="dw-plain-size">${renderSize(record, ui)}</div>`}<small>${escapeHtml(details.join(" · "))} · ${time}</small>`
      : `${columns.join(" · ")}<small>${escapeHtml(details.join(" · "))}</small>`;
  return `<li>${content}${customActions}${download}</li>`;
}

/** A no-icon, no-script theme that leaves navigation and controls to the browser. */
export function createPlainTheme(options: PlainThemeOptions = {}): ExplorerTheme {
  if ("portableLinks" in options)
    throw new TypeError(
      "portableLinks moved to Core routing.directoryUrls: use explicit for true, slash for false",
    );
  assertThemeOptions(options, ["project", "renderEntry", "renderEntryActions"]);
  const ui = resolveCustomization(options);
  if (ui.actions.some((action) => action !== "download"))
    throw new TypeError(
      "Plain supports native download actions only; copy actions require a browser runtime supplied by a custom theme",
    );
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
      siteName: ui.brand.name ?? project.name,
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
          : context.hrefForDirectory(context.directory.parent.relativePath);
      const parentRow =
        parentHref === null ? "" : `<li><a href="${escapeHtml(parentHref)}">../</a></li>`;
      const rows = context.directory.entries
        .map((entry) => renderEntry(entry, context, options, ui))
        .join("");
      const count = context.directory.entries.length;
      const page = context.listing?.page;
      const pagination =
        page === undefined || page.count === 1
          ? ""
          : `<nav aria-label="${escapeHtml(ui.labels.pagination)}">${page.previousHref === null ? "" : `<a rel="prev" href="${escapeHtml(page.previousHref)}">${escapeHtml(ui.labels.previous)}</a> · `}${escapeHtml(label(ui, "page", { page: page.number, pages: page.count }))}${page.nextHref === null ? "" : ` · <a rel="next" href="${escapeHtml(page.nextHref)}">${escapeHtml(ui.labels.next)}</a>`}</nav>`;
      const countLabel =
        page === undefined || page.count === 1
          ? label(ui, "entries", { count })
          : label(ui, "pageEntries", { count, total: page.total });
      const fallbackTitle =
        options.project?.name === undefined && ui.brand.name === undefined
          ? label(ui, "indexOf", { path: visiblePath })
          : context.directory.current.relativePath
            ? `${context.directory.current.relativePath} · ${ui.brand.name ?? project.name}`
            : (ui.brand.name ?? project.name);
      const footer =
        options.project === undefined
          ? ""
          : `<footer><hr><p>${escapeHtml(ui.labels.repository)}: ${externalLink(project.name, repositoryHref)} ${escapeHtml(ui.labels.author)} ${escapeHtml(project.author)} · ${externalLink(project.license, licenseHref)}</p></footer>`;
      const html = `<!doctype html>
<html lang="${escapeHtml(ui.language)}" dir="${ui.direction}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${context.documentBaseHref === null ? "" : `<base href="${escapeHtml(context.documentBaseHref)}">`}${context.metadata?.head ?? `<title>${escapeHtml(fallbackTitle)}${page === undefined || page.count === 1 ? "" : ` · page ${page.number}`}</title>`}${ui.brand.faviconUrl ? `<link rel="icon" href="${escapeHtml(ui.brand.faviconUrl)}">` : ""}<style>:root{color-scheme:light dark}body{max-width:72ch;margin:2rem auto;padding:0 1rem}h1,li,nav{overflow-wrap:anywhere}li{margin:.6rem 0}small{display:block}${customizationCss(ui)}</style></head>
<body><main>${ui.brand.logoUrl ? `<img src="${escapeHtml(ui.brand.logoUrl)}" alt="${escapeHtml(ui.brand.logoAlt ?? "")}" width="40" height="40">` : ""}${ui.brand.name ? `<header>${escapeHtml(ui.brand.name)}</header>` : ""}${renderBreadcrumbs(context, context.hrefForDirectory, ui)}<h1>${escapeHtml(label(ui, "indexOf", { path: visiblePath }))}</h1><p>${countLabel}</p>${pagination}${count === 0 ? `<p>${escapeHtml(ui.labels.empty)}</p>` : ""}<ul>${parentRow}${rows}</ul>${pagination}</main>${ui.brand.footerText ? `<footer>${ui.brand.footerUrl ? `<a href="${escapeHtml(ui.brand.footerUrl)}">${escapeHtml(ui.brand.footerText)}</a>` : escapeHtml(ui.brand.footerText)}</footer>` : footer}</body></html>`;
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
