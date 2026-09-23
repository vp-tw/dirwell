import type { FileSystemEntry } from "../model.ts";
import type { DirwellThemeComponents, IconName } from "../theme-components.ts";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type SelectControlName = "color-scheme" | "sort-field" | "name-mode" | "sort-direction";

function renderSelectControl(
  name: SelectControlName,
  options: readonly (readonly [value: string, label: string])[],
): string {
  const choices = options
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
  return `<select data-${name}>${choices}</select>`;
}

function renderTypeFilters(): string {
  return `<fieldset class="type-filters" data-type-filters><legend class="visually-hidden">Show file types</legend>${(
    [
      ["directory", "Folders"],
      ["file", "Files"],
      ["link", "Links"],
    ] as const
  )
    .map(
      ([value, label]) =>
        `<label><input type="checkbox" value="${value}" data-type-filter checked><span>${label}</span></label>`,
    )
    .join("")}</fieldset>`;
}

function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 || value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function badge(entry: FileSystemEntry): string {
  if (entry.symlink?.isCycle) return '<span class="badge warning">cycle</span>';
  if (entry.symlink?.isBroken) return '<span class="badge warning">broken link</span>';
  if (entry.symlink?.isOutsideRoot) return '<span class="badge">external link</span>';
  if (entry.kind === "symlink") return '<span class="badge">link</span>';
  return "";
}

const iconPaths: Record<IconName, string> = {
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14 2 14 8 20 8"/>',
  folder:
    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  moon: '<path d="M20.99 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 20.99 12.79z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.42"/>',
};

export const defaultThemeComponents: DirwellThemeComponents = {
  Icon: ({ label, name, size = 16 }) =>
    `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"${label === undefined ? ' aria-hidden="true"' : ` role="img" aria-label="${escapeHtml(label)}"`}>${iconPaths[name]}</svg>`,
  Breadcrumbs: ({ items }) =>
    `<nav class="breadcrumbs" aria-label="Breadcrumb">${items
      .map((item) =>
        item.href === null
          ? `<span aria-current="page">${escapeHtml(item.label)}</span>`
          : `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`,
      )
      .join('<span class="separator" aria-hidden="true">/</span>')}</nav>`,
  Toolbar: ({
    colorScheme,
    fuzzySearch,
    globalSearch,
    keyboardNavigation,
    searchIcon,
    sorting,
  }) => {
    const shortcutAttributes = keyboardNavigation
      ? ' aria-keyshortcuts="/" aria-describedby="keyboard-shortcuts"'
      : "";
    const searchAll = globalSearch
      ? `<button class="search-all" type="button" data-global-open>Search all files</button>`
      : "";
    const search = fuzzySearch
      ? `<div class="search-cluster"><label class="search">${searchIcon}<span class="visually-hidden">Search this folder</span><input type="search" autocomplete="off" placeholder="Search this folder"${shortcutAttributes} data-search-input></label>${renderTypeFilters()}${searchAll}</div>`
      : searchAll;
    const scheme = colorScheme
      ? `<label class="scheme">Theme${renderSelectControl("color-scheme", [
          ["system", "System"],
          ["light", "Light"],
          ["dark", "Dark"],
        ])}</label>`
      : "";
    const sort = sorting
      ? `<details class="sort-panel"><summary>Sort</summary><div class="sort-menu"><label>Sort by${renderSelectControl(
          "sort-field",
          [
            ["name", "Name"],
            ["modified", "Modified"],
            ["size", "Size"],
          ],
        )}</label><label data-name-mode-control>Name order${renderSelectControl("name-mode", [
          ["natural", "Natural (numbers)"],
          ["locale", "Locale"],
          ["unicode", "Unicode"],
        ])}</label><label>Direction${renderSelectControl("sort-direction", [
          ["asc", "Ascending"],
          ["desc", "Descending"],
        ])}</label><label><input type="checkbox" data-directories-first> Folders first</label></div></details>`
      : "";
    return search || scheme || sort
      ? `<div class="toolbar">${search}<div class="toolbar-actions">${sort}${scheme}</div></div>`
      : "";
  },
  EntryRow: ({ entry, icon, index, navigation }) => {
    const directoryLike = entry.kind === "directory" || entry.symlink?.targetKind === "directory";
    const size = directoryLike ? "directory" : formatSize(entry.metadata.size);
    const modified = entry.metadata.times.modifiedAt.slice(0, 16).replace("T", " ");
    const linkAttributes = navigation.exitsExplorer ? ' target="_blank" rel="noopener"' : "";
    const label = `${escapeHtml(entry.name)}${directoryLike ? "/" : ""}`;
    const target =
      entry.symlink === null
        ? ""
        : `<span class="target"><span class="target-label">Target:</span> ${escapeHtml(entry.symlink.target)}</span>`;
    const searchText = escapeHtml(`${entry.name} ${entry.symlink?.target ?? ""}`.toLowerCase());
    const name = `<span class="entry-name">${icon}<span>${label}</span></span>`;
    const kind = directoryLike
      ? "directory"
      : entry.kind === "symlink" && entry.symlink?.targetKind === null
        ? "link"
        : "file";
    return `<li class="entry" data-entry data-order="${index}" data-search="${searchText}" data-name="${escapeHtml(entry.name)}" data-size="${directoryLike ? 0 : entry.metadata.size}" data-modified="${Date.parse(entry.metadata.times.modifiedAt)}" data-directory="${String(directoryLike)}" data-link="${String(entry.kind === "symlink")}" data-kind="${kind}">
      <span class="identity">${navigation.href === null ? `<span class="name unavailable">${name}</span>` : `<a class="name" href="${escapeHtml(navigation.href)}"${linkAttributes}>${name}</a>`}${target}</span>
      <span class="kind">${badge(entry)}${size}</span>
      <time datetime="${entry.metadata.times.modifiedAt}">${modified} UTC</time>
    </li>`;
  },
  EntryList: ({ directory, parentHref, rows, sorting }) => {
    const headings = (["name", "size", "modified"] as const)
      .map((field) =>
        sorting
          ? `<button class="sort-heading" type="button" data-sort-heading="${field}">${field}</button>`
          : `<span class="sort-heading">${field}</span>`,
      )
      .join("");
    return `<div class="entry-head">${headings}</div><ul class="entries" data-entry-list>${directory.depth > 0 && parentHref !== null ? `<li class="entry" data-parent><a class="name" href="${escapeHtml(parentHref)}">../</a><span class="kind">parent</span><span></span></li>` : ""}${rows}</ul>`;
  },
  EmptyState: ({ message }) => `<p class="empty" data-empty hidden>${escapeHtml(message)}</p>`,
  Footer: ({ keyboardNavigation, parentHref, project }) => {
    const shortcuts = keyboardNavigation
      ? `<p class="shortcuts" id="keyboard-shortcuts"><kbd>/</kbd> search <kbd>↑</kbd><kbd>↓</kbd> browse <kbd>Esc</kbd> clear${parentHref === null ? "" : " <kbd>Backspace</kbd> parent"}</p>`
      : "";
    return `<footer><p class="project-meta"><a href="${escapeHtml(project.repositoryUrl)}" target="_blank" rel="noopener">${escapeHtml(project.name)}</a> by ${escapeHtml(project.author)}<a href="${escapeHtml(project.licenseUrl)}" target="_blank" rel="noopener">${escapeHtml(project.license)}</a></p>${shortcuts}</footer>`;
  },
  PageShell: ({
    assets,
    breadcrumbs,
    directory,
    documentBaseHref,
    emptyState,
    entryList,
    footer,
    parentHref,
    runtimeConfig,
    styles,
    toolbar,
    visiblePath,
  }) => `<!doctype html>
<html lang="en" data-theme="system"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">${documentBaseHref === null ? "" : `<base href="${escapeHtml(documentBaseHref)}">`}<title>${escapeHtml(visiblePath)} · Files</title><style>${styles}</style></head>
<body><main data-explorer data-config="${escapeHtml(JSON.stringify(runtimeConfig))}"${parentHref === null ? "" : ` data-parent-href="${escapeHtml(parentHref)}"`}>
<header><div class="chrome">${breadcrumbs}<p class="summary"><span data-visible-count>${directory.entries.length}</span> <span data-count-label>${directory.entries.length === 1 ? "entry" : "entries"}</span></p></div><h1 class="visually-hidden">${escapeHtml(visiblePath)}</h1></header>
${toolbar}${entryList}${runtimeConfig.entriesHref ? '<p class="folder-loading" data-folder-loading>Loading this folder…</p><noscript><style>[data-folder-loading]{display:none}</style><p class="folder-loading">This large folder needs JavaScript. Use SSG mode for a complete HTML listing.</p></noscript>' : ""}${emptyState}<p class="visually-hidden" aria-live="polite" data-live-status></p>${footer}</main>${
    runtimeConfig.globalSearch
      ? `<dialog class="global-search" data-global-dialog aria-labelledby="global-search-title"><div class="global-search-head"><h2 id="global-search-title">Search all files</h2><button type="button" class="dialog-close" data-global-close aria-label="Close search">Close</button></div><p>Search across the published directory. The index loads only after you type.</p><div class="global-search-controls"><label class="search"><span class="visually-hidden">Search all files</span><input type="search" autocomplete="off" placeholder="Type a name or path" data-global-input></label>${renderTypeFilters()}</div><p class="global-search-status" data-global-status role="status">Enter a search to begin.</p><ul class="entries global-results" data-global-results></ul></dialog>`
      : ""
  }${assets}</body></html>`,
};
