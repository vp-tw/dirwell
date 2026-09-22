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
  readonly keyboardNavigation?: boolean;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
:root{color-scheme:light dark;--paper:#f7f6f1;--ink:#252722;--muted:#686d64;--rule:#cccec5;--accent:#075ba7;--focus:#e37b2e;--hover:#ecebe4;--control:#fff}
:root[data-theme="light"]{color-scheme:light;--paper:#f7f6f1;--ink:#252722;--muted:#686d64;--rule:#cccec5;--accent:#075ba7;--focus:#e37b2e;--hover:#ecebe4;--control:#fff}
:root[data-theme="dark"]{color-scheme:dark;--paper:#171916;--ink:#eef0e9;--muted:#aeb4a8;--rule:#3b4038;--accent:#79b9f2;--focus:#ffae70;--hover:#22251f;--control:#0f110e}
@media(prefers-color-scheme:dark){:root[data-theme="system"]{--paper:#171916;--ink:#eef0e9;--muted:#aeb4a8;--rule:#3b4038;--accent:#79b9f2;--focus:#ffae70;--hover:#22251f;--control:#0f110e}}
*{box-sizing:border-box}html{background:var(--paper);color:var(--ink)}body{margin:0;font:15px/1.45 ui-sans-serif,system-ui,sans-serif;font-variant-numeric:tabular-nums}button,input{font:inherit}main{width:min(72rem,calc(100% - 2rem));margin:0 auto;padding:clamp(2.5rem,7vw,6rem) 0}header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1rem;align-items:end;border-bottom:2px solid var(--ink);padding-bottom:1rem}h1{margin:0;font-size:clamp(1.6rem,4vw,3.5rem);letter-spacing:-.035em;line-height:1.02;overflow-wrap:anywhere}.breadcrumbs{display:flex;align-items:center;flex-wrap:wrap;gap:.2em}.breadcrumbs a,.breadcrumbs span{color:inherit}.breadcrumbs a{text-decoration-thickness:.055em}.separator{display:inline-flex;color:var(--muted);font-weight:400}.summary{margin:0;color:var(--muted);white-space:nowrap}.toolbar{display:flex;justify-content:space-between;gap:1rem;margin:1rem 0;align-items:center}.search{display:flex;align-items:center;gap:.55rem;width:min(28rem,100%);padding:.5rem .7rem;border:1px solid var(--rule);background:var(--control)}.search:focus-within{outline:3px solid var(--focus);outline-offset:2px}.search input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--ink)}.search input::placeholder{color:var(--muted)}.scheme{display:flex;margin:0;padding:.2rem;border:1px solid var(--rule)}.scheme button{border:0;padding:.35rem .6rem;background:transparent;color:var(--muted);cursor:pointer}.scheme button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}.entries{list-style:none;margin:0;padding:0}.entry{display:grid;grid-template-columns:minmax(12rem,1fr) minmax(8rem,auto) 12rem;gap:1.25rem;align-items:baseline;padding:.78rem .2rem;border-bottom:1px solid var(--rule)}.entry:hover,.entry[data-active="true"]{background:var(--hover)}.entry[hidden]{display:none}a{color:var(--accent);text-decoration-thickness:.08em;text-underline-offset:.2em}.identity{display:flex;min-width:0;flex-wrap:wrap;column-gap:.65rem}.entry-name{display:inline-flex;align-items:center;gap:.5rem}.name{font-weight:650;overflow-wrap:anywhere}.icon{display:inline-block;flex:none;vertical-align:-.15em}.target{color:var(--muted);font:500 .8rem/1.6 ui-monospace,SFMono-Regular,monospace;overflow-wrap:anywhere}.unavailable{color:var(--muted);text-decoration:line-through;text-decoration-thickness:1px}.kind,time{color:var(--muted);font-size:.86rem}.badge{display:inline-block;margin-right:.5rem;padding:.08rem .4rem;border:1px solid currentColor;border-radius:999px;font-size:.72rem}.warning{color:#a34710}a:focus-visible,button:focus-visible{outline:3px solid var(--focus);outline-offset:3px}.empty{padding:2rem .2rem;color:var(--muted);border-bottom:1px solid var(--rule)}::selection{background:var(--accent);color:var(--paper)}footer{display:flex;justify-content:space-between;gap:1rem;margin-top:2rem;color:var(--muted);font-size:.82rem}.shortcuts{margin:0}kbd{display:inline-block;min-width:1.6em;margin:0 .12rem;padding:.02rem .3rem;border:1px solid var(--rule);background:var(--control);text-align:center;font:inherit}.visually-hidden{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:42rem){header{display:block}.summary{margin-top:.75rem}.toolbar{align-items:stretch;flex-direction:column}.scheme{align-self:flex-start}.entry{grid-template-columns:minmax(0,1fr) auto;gap:.25rem 1rem}.entry time{grid-column:1/-1}.kind{text-align:right}footer{display:block}.shortcuts{margin-top:.75rem}}
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
  Toolbar: ({ colorScheme, fuzzySearch, keyboardNavigation, searchIcon }) => {
    const shortcutAttributes = keyboardNavigation
      ? ' aria-keyshortcuts="/" aria-describedby="keyboard-shortcuts"'
      : "";
    const search = fuzzySearch
      ? `<label class="search">${searchIcon}<span class="visually-hidden">Filter entries</span><input type="search" autocomplete="off" placeholder="Filter this directory"${shortcutAttributes} data-search-input></label>`
      : "";
    const scheme = colorScheme
      ? '<fieldset class="scheme" data-scheme-control><legend class="visually-hidden">Color scheme</legend><button type="button" data-theme-value="system" aria-pressed="true">System</button><button type="button" data-theme-value="light" aria-pressed="false">Light</button><button type="button" data-theme-value="dark" aria-pressed="false">Dark</button></fieldset>'
      : "";
    return search || scheme ? `<div class="toolbar">${search}${scheme}</div>` : "";
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
        : `<span class="target">→ ${escapeHtml(entry.symlink.target)}</span>`;
    const searchText = escapeHtml(`${entry.name} ${entry.symlink?.target ?? ""}`.toLowerCase());
    const name = `<span class="entry-name">${icon}<span>${label}</span></span>`;
    return `<li class="entry" data-entry data-order="${index}" data-search="${searchText}">
      <span class="identity">${navigation.href === null ? `<span class="name unavailable">${name}</span>` : `<a class="name" href="${escapeHtml(navigation.href)}"${linkAttributes}>${name}</a>`}${target}</span>
      <span class="kind">${badge(entry)}${size}</span>
      <time datetime="${entry.metadata.times.modifiedAt}">${modified} UTC</time>
    </li>`;
  },
  EntryList: ({ directory, rows }) =>
    `<ul class="entries" data-entry-list>${directory.depth > 0 ? '<li class="entry" data-parent><a class="name" href="../">../</a><span class="kind">parent</span><span></span></li>' : ""}${rows}</ul>`,
  EmptyState: ({ message }) => `<p class="empty" data-empty hidden>${escapeHtml(message)}</p>`,
  Footer: ({ keyboardNavigation, parentHref }) => {
    const shortcuts = keyboardNavigation
      ? `<p class="shortcuts" id="keyboard-shortcuts"><kbd>/</kbd> search <kbd>↑</kbd><kbd>↓</kbd> browse <kbd>Esc</kbd> clear${parentHref === null ? "" : " <kbd>Backspace</kbd> parent"}</p>`
      : "";
    return `<footer><span>Static directory index</span>${shortcuts}</footer>`;
  },
  PageShell: ({
    assets,
    breadcrumbs,
    directory,
    emptyState,
    entryList,
    footer,
    runtimeConfig,
    styles,
    toolbar,
    visiblePath,
  }) => `<!doctype html>
<html lang="en" data-theme="system"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>${escapeHtml(visiblePath)} · Files</title><style>${styles}</style></head>
<body><main data-explorer data-config="${escapeHtml(JSON.stringify(runtimeConfig))}"${directory.depth > 0 ? ' data-parent-href="../"' : ""}>
<header><h1><span class="visually-hidden">Directory ${escapeHtml(visiblePath)}</span>${breadcrumbs}</h1><p class="summary"><span data-visible-count>${directory.entries.length}</span> <span data-count-label>${directory.entries.length === 1 ? "entry" : "entries"}</span></p></header>
${toolbar}${entryList}${emptyState}<p class="visually-hidden" aria-live="polite" data-live-status></p>${footer}</main>${assets}</body></html>`,
};

function createBreadcrumbs(relativePath: string): readonly BreadcrumbItem[] {
  const segments = relativePath === "" ? [] : relativePath.split("/");
  return [
    {
      href: segments.length === 0 ? null : "../".repeat(segments.length),
      isCurrent: segments.length === 0,
      label: "/",
    },
    ...segments.map((label, index) => ({
      href: index === segments.length - 1 ? null : "../".repeat(segments.length - index - 1),
      isCurrent: index === segments.length - 1,
      label,
    })),
  ];
}

export function createDefaultTheme(options: DefaultThemeOptions = {}): ExplorerTheme {
  const colorScheme = options.colorScheme ?? true;
  const fuzzySearch = options.fuzzySearch ?? true;
  const keyboardNavigation = options.keyboardNavigation ?? true;
  const interactive = colorScheme || fuzzySearch || keyboardNavigation;
  const layers =
    options.components === undefined
      ? []
      : Array.isArray(options.components)
        ? options.components
        : [options.components];
  const components = resolveThemeComponents(defaultThemeComponents, ...layers);

  return {
    name: "ledger",
    render({ assetHref, directory, exitsExplorerFor, hrefFor }) {
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
      const runtimeConfig = { colorScheme, fuzzySearch, keyboardNavigation };
      const html = components.PageShell({
        assets,
        breadcrumbs: components.Breadcrumbs({
          items: createBreadcrumbs(directory.current.relativePath),
        }),
        directory,
        emptyState: components.EmptyState({ message: "No matching entries." }),
        entryList: components.EntryList({ directory, rows }),
        footer: components.Footer({
          keyboardNavigation,
          parentHref: directory.depth > 0 ? "../" : null,
        }),
        runtimeConfig,
        styles: defaultStyles,
        toolbar: components.Toolbar({
          colorScheme,
          fuzzySearch,
          keyboardNavigation,
          searchIcon: components.Icon({ name: "search" }),
        }),
        visiblePath,
      });
      return interactive ? { html, assets: { "dirwell.runtime.js": runtimeSource } } : { html };
    },
  };
}

export const defaultTheme = createDefaultTheme();
