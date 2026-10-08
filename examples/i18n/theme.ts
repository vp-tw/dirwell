import { readFile } from "node:fs/promises";
import {
  escapeHtml,
  type ExplorerTheme,
  type FileSystemEntry,
  type ThemeContext,
} from "../../src/index.ts";
import { translations } from "./translations.ts";

const styles = await readFile(new URL("./theme.css", import.meta.url), "utf8");
const runtime = await readFile(new URL("./runtime.js", import.meta.url), "utf8");
const english = translations.en;

function status(entry: FileSystemEntry): keyof typeof english {
  if (entry.symlink?.isBroken) return "broken";
  if (entry.symlink?.isOutsideRoot || entry.symlink?.isTargetExcluded) return "outside";
  if (entry.symlink?.isCycle) return "cycle";
  return entry.kind === "directory" ? "folder" : entry.kind === "symlink" ? "link" : "file";
}

function entryHtml(entry: FileSystemEntry, context: ThemeContext): string {
  const href = context.hrefFor(entry);
  const directory = entry.kind === "directory" || entry.symlink?.targetKind === "directory";
  const exits = context.exitsExplorerFor(entry);
  const name = escapeHtml(`${entry.name}${directory ? "/" : ""}`);
  const identity =
    href === null
      ? `<span class="unavailable">${name}</span>`
      : `<a href="${escapeHtml(href)}"${exits ? ' target="_blank" rel="noopener"' : ""}>${name}</a>`;
  const kind = status(entry);
  const size =
    directory || entry.symlink?.isOutsideRoot || entry.symlink?.isTargetExcluded
      ? ""
      : `<span data-size="${entry.symlink?.targetSize ?? entry.metadata.size}">${entry.symlink?.targetSize ?? entry.metadata.size} B</span>`;
  const instant = new Date(entry.metadata.times.modifiedAt);
  const modified = Number.isNaN(instant.getTime())
    ? `<span data-i18n="unknown">${english.unknown}</span>`
    : `<time datetime="${instant.toISOString()}">${instant.toISOString().slice(0, 16).replace("T", " ")} UTC</time>`;
  const target =
    entry.symlink === null
      ? ""
      : `<span class="target"><span data-i18n="target">${english.target}</span>: ${escapeHtml(entry.symlink.target)}</span>`;
  return `<li><div class="identity">${identity}${exits ? `<small data-i18n="newTab">${english.newTab}</small>` : ""}${target}</div><div class="metadata"><span data-i18n="${kind}">${english[kind]}</span>${size}${modified}</div></li>`;
}

/** A complete renderer with its own small, optional localization runtime. */
export const internationalTheme: ExplorerTheme = {
  name: "international-example",
  searchIndex: false,
  render(context) {
    const { directory } = context;
    const segments = directory.current.relativePath.split("/").filter(Boolean);
    const ancestors = segments
      .slice(0, -1)
      .map(
        (segment, index) =>
          `<a href="${escapeHtml(context.hrefForDirectory(segments.slice(0, index + 1).join("/")))}">${escapeHtml(segment)}</a>`,
      )
      .join('<span aria-hidden="true">/</span>');
    const breadcrumbs = `<nav data-i18n-label="breadcrumb" aria-label="${english.breadcrumb}"><a data-i18n="home" href="${escapeHtml(context.hrefForDirectory(""))}">${english.home}</a>${ancestors ? `<span aria-hidden="true">/</span>${ancestors}` : ""}${segments.length ? `<span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(segments.at(-1)!)}</span>` : ""}</nav>`;
    const parent =
      directory.parent === null
        ? ""
        : `<a class="parent" data-i18n="parent" href="${escapeHtml(context.hrefForDirectory(directory.parent.relativePath))}">${english.parent}</a>`;
    const count = directory.entries.length;
    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${context.documentBaseHref === null ? "" : `<base href="${escapeHtml(context.documentBaseHref)}">`}<title>Files · ${escapeHtml(directory.current.relativePath || "/")}</title><link rel="stylesheet" href="${escapeHtml(context.assetHref("i18n.css"))}"><script type="module" src="${escapeHtml(context.assetHref("i18n.js"))}"></script></head>
<body><main data-i18n-theme data-translations="${escapeHtml(JSON.stringify(translations))}" data-path="${escapeHtml(directory.current.relativePath || "/")}" data-count="${count}">
<header><div class="heading"><h1 data-i18n="title">${english.title}</h1><div class="language" hidden><label for="language" data-i18n="language">${english.language}</label><select id="language"><option value="en" lang="en">English</option><option value="zh-TW" lang="zh-TW">繁體中文</option><option value="ja" lang="ja">日本語</option></select></div></div>${breadcrumbs}<p class="path">/${escapeHtml(directory.current.relativePath)}${directory.current.relativePath ? "/" : ""}</p><p data-entry-count>${(count === 1 ? english.countOne : english.countOther).replace("{count}", String(count))}</p>${parent}</header>
${count === 0 ? `<p class="empty" data-i18n="empty">${english.empty}</p>` : `<ul>${directory.entries.map((entry) => entryHtml(entry, context)).join("")}</ul>`}
<p class="notice" role="status" aria-live="polite" data-language-notice></p><noscript><p>English listing and UTC dates are available without JavaScript.</p></noscript><footer data-i18n="footer">${english.footer}</footer>
</main></body></html>`;
    return { html, assets: { "i18n.css": styles, "i18n.js": runtime } };
  },
};
