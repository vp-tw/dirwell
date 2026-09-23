import { readFile } from "node:fs/promises";
import type { ExplorerTheme, FileSystemEntry } from "./model.ts";
import {
  resolveThemeComponents,
  type BreadcrumbItem,
  type DirwellThemeComponents,
  type DirwellThemeComponentOverrides,
  type IconName,
} from "./theme-components.ts";

const runtimeSource = await readFile(new URL("./theme-runtime.js", import.meta.url), "utf8");

export interface DefaultThemeOptions {
  readonly colorScheme?: boolean;
  readonly components?: DirwellThemeComponentOverrides | readonly DirwellThemeComponentOverrides[];
  readonly fuzzySearch?: boolean;
  readonly globalSearch?: boolean;
  readonly keyboardNavigation?: boolean;
  readonly project?: Readonly<{
    author?: string;
    license?: string;
    licenseUrl?: string;
    name?: string;
    repositoryUrl?: string;
  }>;
  readonly sorting?: boolean;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

type SelectControlName =
  | "search-scope"
  | "search-filter"
  | "sort-field"
  | "name-mode"
  | "sort-direction";

function renderSelectControl(
  name: SelectControlName,
  options: readonly (readonly [value: string, label: string])[],
): string {
  const choices = options
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");
  return `<select data-${name}>${choices}</select>`;
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

const defaultStyles = `
:root{color-scheme:light dark;--paper:#f3f0e8;--surface:#fbfaf6;--ink:#171815;--muted:#64655f;--rule:#c9c5ba;--soft-rule:#e3dfd5;--accent:#174ea6;--accent-strong:#103973;--focus:#005fcc;--hover:#f0eee7;--control:#fff;--status:#34705c;--warning:#9a4616;--shadow:0 30px 80px rgba(46,46,40,.14)}
:root[data-theme="light"]{color-scheme:light;--paper:#f3f0e8;--surface:#fbfaf6;--ink:#171815;--muted:#64655f;--rule:#c9c5ba;--soft-rule:#e3dfd5;--accent:#174ea6;--accent-strong:#103973;--focus:#005fcc;--hover:#f0eee7;--control:#fff;--status:#34705c;--warning:#9a4616;--shadow:0 30px 80px rgba(46,46,40,.14)}
:root[data-theme="dark"]{color-scheme:dark;--paper:#11130f;--surface:#191b17;--ink:#f2f0e8;--muted:#b1b4ab;--rule:#474a42;--soft-rule:#30332d;--accent:#91bff0;--accent-strong:#b7d5f4;--focus:#78b7f4;--hover:#22251f;--control:#10120f;--status:#8bc0aa;--warning:#f0a06d;--shadow:0 30px 80px rgba(0,0,0,.28)}
@media(prefers-color-scheme:dark){:root[data-theme="system"]{--paper:#11130f;--surface:#191b17;--ink:#f2f0e8;--muted:#b1b4ab;--rule:#474a42;--soft-rule:#30332d;--accent:#91bff0;--accent-strong:#b7d5f4;--focus:#78b7f4;--hover:#22251f;--control:#10120f;--status:#8bc0aa;--warning:#f0a06d;--shadow:0 30px 80px rgba(0,0,0,.28)}}
*{box-sizing:border-box}html{min-height:100%;background:var(--paper);color:var(--ink)}body{min-width:20rem;margin:0;padding:clamp(1rem,5vw,4rem);font:15px/1.45 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}button,input,select{font:inherit}main{width:min(72rem,100%);margin:0 auto;background:var(--surface);border:1px solid var(--rule);border-radius:.875rem;box-shadow:var(--shadow);overflow:hidden}.chrome{display:flex;min-height:3.4rem;align-items:center;justify-content:space-between;gap:1rem;padding:0 1.4rem;border-bottom:1px solid var(--soft-rule)}.breadcrumbs{display:flex;min-width:0;align-items:center;flex-wrap:wrap;gap:.15rem;font-size:.95rem;font-weight:650}.breadcrumbs a,.breadcrumbs span{color:inherit}.breadcrumbs a{color:var(--accent);text-decoration-thickness:.08em}.separator{display:inline-flex;color:var(--muted);font-weight:400}.summary{margin:0;color:var(--muted);font-size:.76rem;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}.toolbar{display:flex;justify-content:space-between;gap:1rem;padding:1.25rem 1.4rem;align-items:flex-start}.search-cluster{display:flex;min-width:0;flex:1;gap:.6rem;align-items:center}.search{display:flex;align-items:center;gap:.55rem;width:min(28rem,100%);min-height:2.55rem;padding:.5rem .7rem;border:1px solid var(--rule);border-radius:.5rem;background:var(--control)}.search:focus-within{outline:3px solid var(--focus);outline-offset:2px}.search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--ink)}.search input::placeholder{color:var(--muted);opacity:1}.compact-select,.include-links{display:flex;align-items:center;gap:.35rem;color:var(--muted);font-size:.78rem}.compact-select select,.sort-menu select{min-height:2.55rem;border:1px solid var(--rule);border-radius:.5rem;background:var(--control);color:var(--ink);padding:.35rem 1.8rem .35rem .55rem}.include-links[hidden]{display:none}.toolbar-actions{display:flex;align-items:flex-start;gap:.6rem}.scheme{display:flex;margin:0;padding:.18rem;border:1px solid var(--rule);border-radius:.5rem}.scheme button{min-height:2.15rem;border:0;border-radius:.34rem;padding:.35rem .65rem;background:transparent;color:var(--muted);cursor:pointer}.scheme button:hover{color:var(--ink)}.scheme button[aria-pressed="true"]{background:var(--ink);color:var(--surface)}.sort-panel{position:relative}.sort-panel>summary{display:flex;min-height:2.55rem;align-items:center;list-style:none;border:1px solid var(--rule);border-radius:.5rem;background:var(--control);padding:.45rem .7rem;cursor:pointer}.sort-panel>summary::-webkit-details-marker{display:none}.sort-panel[open]>summary{outline:2px solid var(--focus);outline-offset:1px}.sort-menu{position:absolute;z-index:2;right:0;top:calc(100% + .4rem);display:grid;width:16rem;gap:.7rem;padding:1rem;border:1px solid var(--rule);border-radius:.75rem;background:var(--surface);box-shadow:var(--shadow)}.sort-menu label{display:grid;gap:.3rem;color:var(--muted);font-size:.76rem}.sort-menu label[hidden]{display:none}.sort-menu label:last-child{display:flex;align-items:center;color:var(--ink)}.entry-head,.entry{display:grid;grid-template-columns:minmax(12rem,1fr) minmax(8rem,auto) 12rem;gap:1.25rem}.entry-head{min-height:2.2rem;align-items:center;padding:0 1.4rem;border-top:1px solid var(--soft-rule);border-bottom:1px solid var(--soft-rule);background:var(--paper)}.sort-heading{width:max-content;border:0;background:transparent;color:var(--muted);padding:0;font-size:.68rem;font-weight:720;letter-spacing:.09em;text-transform:uppercase;cursor:pointer}.sort-heading[aria-pressed="true"]{color:var(--accent)}.entries{list-style:none;margin:0;padding:0}.entry{min-height:3.25rem;align-items:center;padding:.72rem 1.4rem;border-bottom:1px solid var(--soft-rule)}.entry:hover,.entry[data-active="true"]{background:var(--hover)}.entry[hidden]{display:none}a{color:var(--accent);text-decoration-thickness:.08em;text-underline-offset:.22em}.identity{display:flex;min-width:0;flex-wrap:wrap;column-gap:.65rem}.entry-name{display:inline-flex;align-items:center;gap:.55rem}.name{font-weight:650;overflow-wrap:anywhere}.icon{display:inline-block;flex:none;vertical-align:-.15em;color:var(--status)}.target{color:var(--muted);font:500 .8rem/1.6 ui-monospace,SFMono-Regular,monospace;overflow-wrap:anywhere}.target-label{font-family:ui-sans-serif,system-ui,sans-serif;font-weight:650}.unavailable{color:var(--muted);text-decoration:line-through;text-decoration-thickness:1px}.kind,time{color:var(--muted);font-size:.82rem}.badge{display:inline-block;margin-right:.5rem;padding:.08rem .4rem;border:1px solid currentColor;border-radius:999px;font-size:.72rem}.warning{color:var(--warning)}a:focus-visible,button:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--focus);outline-offset:3px}.empty{margin:0;padding:2rem 1.4rem;color:var(--muted);border-bottom:1px solid var(--soft-rule)}::selection{background:var(--accent);color:var(--surface)}footer{display:flex;justify-content:space-between;gap:1rem;padding:1.5rem 1.4rem;color:var(--muted);font-size:.78rem}.project-meta,.shortcuts{margin:0}.project-meta a{margin-left:.55rem}.shortcuts{text-align:right}kbd{display:inline-block;min-width:1.6em;margin:0 .12rem;padding:.02rem .3rem;border:1px solid var(--rule);border-radius:.2rem;background:var(--control);text-align:center;font:inherit}.visually-hidden{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.breadcrumbs a{display:inline-flex;min-height:2.25rem;align-items:center;padding:0 .2rem}
.sort-heading:not(button){cursor:default}
:root{--dw-control-height:2.75rem}
body{min-width:0}main{overflow:visible}.breadcrumbs a{min-height:2.75rem}.search,.compact-select select,.sort-menu select,.sort-panel>summary,.scheme button,.include-links{min-height:var(--dw-control-height)}
.scheme{padding:0;border:0;outline:1px solid var(--rule);outline-offset:-1px}
@media(max-width:60rem){.toolbar{align-items:stretch;flex-direction:column}.search-cluster{align-items:stretch;flex-wrap:wrap}.search{width:100%}.compact-select{flex:1}.compact-select select{width:100%}.toolbar-actions{width:100%;justify-content:space-between}.sort-menu{right:auto;left:0}}
@media(max-width:42rem){body{padding:0;background:var(--surface)}main{min-height:100vh;border:0;border-radius:0;box-shadow:none}.chrome{padding-inline:1rem}.toolbar{padding:1rem}.compact-select select{width:100%}.entry-head{display:none}.entry{grid-template-columns:minmax(0,1fr) auto;gap:.25rem 1rem;padding:.78rem 1rem}.entry .name{display:inline-flex;min-height:2.75rem;align-items:center}.entry time{grid-column:1/-1}.kind{text-align:right}footer{display:flex;flex-direction:column-reverse;align-items:flex-start;gap:.4rem;padding:1.1rem 1rem}.project-meta{display:flex;align-items:center;flex-wrap:wrap;gap:.55rem}.project-meta a{display:inline-flex;min-height:2.75rem;align-items:center;margin-left:0}.shortcuts{margin:0;text-align:left}}
@media(max-width:19.5rem){.search-cluster{display:grid;grid-template-columns:minmax(0,1fr)}.compact-select{width:100%}.toolbar-actions{flex-wrap:wrap}.sort-menu{width:min(16rem,calc(100vw - 2rem))}}
@media(pointer:coarse){.entry .name,.project-meta a{display:inline-flex;min-height:2.75rem;align-items:center}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}`;

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
    const scope = globalSearch
      ? `<label class="compact-select"><span class="visually-hidden">Search scope</span>${renderSelectControl(
          "search-scope",
          [
            ["current", "This folder"],
            ["global", "Everywhere"],
          ],
        )}</label>`
      : "";
    const filter = `<label class="compact-select"><span class="visually-hidden">File type</span>${renderSelectControl(
      "search-filter",
      [
        ["all", "Everything"],
        ["directory", "Folders"],
        ["file", "Files"],
        ["link", "Links"],
      ],
    )}</label>`;
    const search = fuzzySearch
      ? `<div class="search-cluster"><label class="search">${searchIcon}<span class="visually-hidden">Search files</span><input type="search" autocomplete="off" placeholder="Search files"${shortcutAttributes} data-search-input></label>${scope}${filter}<label class="include-links" data-include-links-control hidden><input type="checkbox" data-include-links checked> Include links</label></div>`
      : "";
    const scheme = colorScheme
      ? `<fieldset class="scheme" data-scheme-control><legend class="visually-hidden">Color scheme</legend>${(
          [
            ["system", "System"],
            ["light", "Light"],
            ["dark", "Dark"],
          ] as const
        )
          .map(
            ([value, label]) =>
              `<button type="button" data-theme-value="${value}" aria-pressed="${value === "system"}">${label}</button>`,
          )
          .join("")}</fieldset>`
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
${toolbar}${entryList}${emptyState}<p class="visually-hidden" aria-live="polite" data-live-status></p>${footer}</main>${assets}</body></html>`,
};

function createBreadcrumbs(
  relativePath: string,
  hrefForDirectory: (relativePath: string) => string,
): readonly BreadcrumbItem[] {
  const segments = relativePath === "" ? [] : relativePath.split("/");
  return [
    {
      href: segments.length === 0 ? null : hrefForDirectory(""),
      isCurrent: segments.length === 0,
      label: segments.length === 0 ? "/" : "Home",
    },
    ...segments.map((label, index) => ({
      href:
        index === segments.length - 1
          ? null
          : hrefForDirectory(segments.slice(0, index + 1).join("/")),
      isCurrent: index === segments.length - 1,
      label,
    })),
  ];
}

export function createDefaultTheme(options: DefaultThemeOptions = {}): ExplorerTheme {
  const colorScheme = options.colorScheme ?? true;
  const fuzzySearch = options.fuzzySearch ?? true;
  const globalSearch = options.globalSearch ?? true;
  const keyboardNavigation = options.keyboardNavigation ?? true;
  const sorting = options.sorting ?? true;
  const project = {
    author: options.project?.author ?? "VdustR",
    license: options.project?.license ?? "MIT License",
    licenseUrl:
      options.project?.licenseUrl ?? "https://github.com/VdustR/dirwell/blob/main/LICENSE",
    name: options.project?.name ?? "Dirwell",
    repositoryUrl: options.project?.repositoryUrl ?? "https://github.com/VdustR/dirwell",
  };
  const interactive = colorScheme || fuzzySearch || keyboardNavigation || sorting;
  const layers =
    options.components === undefined
      ? []
      : Array.isArray(options.components)
        ? options.components
        : [options.components];
  const components = resolveThemeComponents(defaultThemeComponents, ...layers);

  return {
    name: "ledger",
    render({
      assetHref,
      directory,
      documentBaseHref,
      exitsExplorerFor,
      hrefFor,
      hrefForDirectory,
      searchIndexHref,
      sort,
    }) {
      const visiblePath =
        directory.current.relativePath === "" ? "/" : `/${directory.current.relativePath}/`;
      const rows = directory.entries
        .map((entry, index) => {
          const directoryLike =
            entry.kind === "directory" || entry.symlink?.targetKind === "directory";
          const iconName = entry.kind === "symlink" ? "link" : directoryLike ? "folder" : "file";
          return components.EntryRow({
            entry,
            icon: components.Icon({ name: iconName }),
            index,
            navigation: { exitsExplorer: exitsExplorerFor(entry), href: hrefFor(entry) },
          });
        })
        .join("");
      const assets = interactive
        ? `<script src="${escapeHtml(assetHref("dirwell.runtime.js"))}" type="module"></script>`
        : "";
      const runtimeConfig = {
        colorScheme,
        fuzzySearch,
        globalSearch,
        keyboardNavigation,
        searchIndexHref,
        sort,
        sorting,
      };
      const parentHref =
        directory.parent === null ? null : hrefForDirectory(directory.parent.relativePath);
      const html = components.PageShell({
        assets,
        breadcrumbs: components.Breadcrumbs({
          items: createBreadcrumbs(directory.current.relativePath, hrefForDirectory),
        }),
        directory,
        documentBaseHref,
        emptyState: components.EmptyState({ message: "No matching entries." }),
        entryList: components.EntryList({ directory, parentHref, rows, sorting }),
        footer: components.Footer({
          keyboardNavigation,
          parentHref,
          project,
        }),
        parentHref,
        runtimeConfig,
        styles: defaultStyles,
        toolbar: components.Toolbar({
          colorScheme,
          fuzzySearch,
          globalSearch,
          keyboardNavigation,
          searchIcon: components.Icon({ name: "search" }),
          sorting,
        }),
        visiblePath,
      });
      return interactive ? { html, assets: { "dirwell.runtime.js": runtimeSource } } : { html };
    },
  };
}

export const defaultTheme = createDefaultTheme();
