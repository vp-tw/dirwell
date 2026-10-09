import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { ExplorerTheme, FileSystemEntry, ThemeContext } from "./model.ts";
import { escapeHtml } from "./theme-default/components.ts";
import { resolveThemeProject, type ThemeProjectOptions } from "./theme-project.ts";
import { crosswaveIcon, type CrosswaveIcon } from "./theme-crosswave/icons.ts";
import { crosswaveStyles } from "./theme-crosswave/styles.ts";

const runtime = await readFile(new URL("./crosswave-runtime.js", import.meta.url), "utf8");
function pageAsset(relativePath: string): string {
  return `crosswave-page-${createHash("sha256").update(relativePath).digest("hex").slice(0, 24)}.js`;
}
function navigationData(context: ThemeContext, relativePath: string, href: string): string {
  const asset = pageAsset(relativePath);
  const dataHref =
    context.mode === "mpa"
      ? context.assetHref(asset)
      : `${href.endsWith("/") ? href : href.slice(0, href.lastIndexOf("/") + 1)}${asset}`;
  return ` data-cw-page="${escapeHtml(dataHref)}" data-cw-path="${escapeHtml(relativePath)}"`;
}
export type CrosswaveColor = "azure" | "violet" | "amber" | "rose" | "jade" | "graphite";
export interface CrosswaveThemeOptions {
  readonly color?: CrosswaveColor;
  readonly backgroundMotion?: boolean;
  readonly pageTransitions?: boolean;
  readonly gamepad?: boolean;
  readonly project?: ThemeProjectOptions;
}

const categories = [
  ["all", "All files"],
  ["folder", "Folders"],
  ["image", "Photos"],
  ["audio", "Music"],
  ["video", "Videos"],
  ["document", "Documents"],
  ["other", "Other"],
] as const;
const extensions: Record<string, CrosswaveIcon> = Object.fromEntries([
  ...["png", "jpg", "jpeg", "webp", "gif", "avif", "svg", "bmp", "heic"].map((x) => [x, "image"]),
  ...["mp3", "wav", "ogg", "flac", "m4a", "aac", "aiff", "opus"].map((x) => [x, "audio"]),
  ...["mp4", "webm", "mov", "mkv", "avi", "m4v"].map((x) => [x, "video"]),
  ...["txt", "md", "pdf", "json", "csv", "html", "xml", "doc", "docx", "rtf", "yaml", "yml"].map(
    (x) => [x, "document"],
  ),
]) as Record<string, CrosswaveIcon>;

function category(entry: FileSystemEntry): CrosswaveIcon {
  if (entry.kind === "directory" || entry.symlink?.targetKind === "directory") return "folder";
  return extensions[entry.name.split(".").at(-1)?.toLowerCase() ?? ""] ?? "other";
}
function size(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const index = bytes > 0 ? Math.min(4, Math.floor(Math.log(bytes) / Math.log(1024))) : 0;
  return `${(bytes / 1024 ** index).toLocaleString("en-US", { maximumFractionDigits: index === 0 ? 0 : 1 })} ${units[index]}`;
}
function status(entry: FileSystemEntry): string {
  if (entry.symlink?.isBroken) return "Broken link · declared target only";
  if (entry.symlink?.isOutsideRoot) return "Outside root · declared target only";
  if (entry.symlink?.isTargetExcluded) return "Excluded target · declared target only";
  if (entry.symlink?.isCycle) return "Directory link · cycle";
  if (entry.kind === "symlink") return "Symbolic link";
  if (entry.kind === "directory") return "Folder";
  return "File";
}
function row(entry: FileSystemEntry, context: ThemeContext, index: number): string {
  const href = context.hrefFor(entry);
  const type = category(entry);
  const icon = entry.kind === "symlink" ? "link" : type;
  const label = `${entry.name}${type === "folder" ? "/" : ""}`;
  const unavailable =
    entry.symlink?.isOutsideRoot || entry.symlink?.isTargetExcluded || entry.symlink?.isBroken;
  const bytes = type === "folder" ? "Folder" : size(entry.metadata.size);
  const instant = new Date(entry.metadata.times.modifiedAt);
  const modified = Number.isNaN(instant.getTime())
    ? "Unknown"
    : `${instant.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  const target =
    entry.symlink === null
      ? ""
      : `<span class="cw-target">${escapeHtml(entry.symlink.target)}</span>`;
  const data = `data-cw-entry data-category="${type}" data-icon="${icon}" data-name="${escapeHtml(entry.name)}" data-path="${escapeHtml(entry.relativePath)}" data-size="${escapeHtml(bytes)}" data-modified="${modified}" data-status="${escapeHtml(status(entry))}" data-exits="${context.exitsExplorerFor(entry)}"`;
  const contents = `<span class="cw-entry-icon">${crosswaveIcon(icon)}</span><span class="cw-entry-label"><span class="cw-name">${escapeHtml(label)}</span>${target}<span class="cw-row-meta">${escapeHtml(status(entry))}${type === "folder" || unavailable ? "" : ` · ${bytes}`}</span><span class="cw-row-date">Modified ${modified}</span></span>`;
  return `<li class="cw-row${index === 0 ? " cw-selected" : ""}" ${data}>${href === null ? `<span class="cw-entry cw-unavailable">${contents}</span>` : `<a class="cw-entry" href="${escapeHtml(href)}"${context.exitsExplorerFor(entry) ? ' target="_blank" rel="noopener"' : ` data-cw-navigation${navigationData(context, entry.symlink?.targetRelativePath ?? entry.relativePath, href)}`}>${contents}</a>`}</li>`;
}

/** PSP-inspired media navigation with original wave graphics and ordinary static links. */
export function createCrosswaveTheme(options: CrosswaveThemeOptions = {}): ExplorerTheme {
  const color = options.color ?? "azure";
  if (!["azure", "violet", "amber", "rose", "jade", "graphite"].includes(color))
    throw new TypeError("Unknown Crosswave color");
  for (const key of ["backgroundMotion", "pageTransitions", "gamepad"] as const) {
    if (options[key] !== undefined && typeof options[key] !== "boolean")
      throw new TypeError(`${key} must be a boolean`);
  }
  const project = resolveThemeProject(options.project);
  return {
    name: "crosswave",
    searchIndex: false,
    render(context) {
      const { directory } = context;
      const path = directory.current.relativePath || "/";
      const parent =
        directory.parent === null ? null : context.hrefForDirectory(directory.parent.relativePath);
      const segments = directory.current.relativePath.split("/").filter(Boolean);
      const breadcrumbs = segments
        .map((segment, i) =>
          i === segments.length - 1
            ? `<span aria-current="page">${escapeHtml(segment)}</span>`
            : `<a data-cw-navigation${navigationData(context, segments.slice(0, i + 1).join("/"), context.hrefForDirectory(segments.slice(0, i + 1).join("/")))} href="${escapeHtml(context.hrefForDirectory(segments.slice(0, i + 1).join("/")))}">${escapeHtml(segment)}</a>`,
        )
        .join('<span class="cw-separator" aria-hidden="true">/</span>');
      const tabs = categories
        .map(
          ([type, label], i) =>
            `<button role="tab" id="cw-tab-${type}" aria-selected="${i === 0}" aria-controls="cw-panel" tabindex="${i === 0 ? 0 : -1}" data-cw-category="${type}" class="cw-category${i === 0 ? " cw-active" : ""}">${crosswaveIcon(type)}<span>${label}</span><small data-cw-category-count="${type}"></small></button>`,
        )
        .join("");
      const html = `<!doctype html>
<html lang="en" data-cw-color="${color}" data-cw-motion="${options.backgroundMotion !== false}" data-cw-transitions="${options.pageTransitions !== false}" data-cw-gamepad="${options.gamepad !== false}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${context.documentBaseHref === null ? "" : `<base href="${escapeHtml(context.documentBaseHref)}">`}<title>${escapeHtml(path)} · ${escapeHtml(project.name)} · Crosswave</title><link rel="stylesheet" href="${escapeHtml(context.assetHref("crosswave.css"))}"><script src="${escapeHtml(context.assetHref("crosswave.js"))}"></script></head>
<body><a class="cw-skip" href="${escapeHtml(context.hrefForDirectory(directory.current.relativePath))}#cw-panel">Skip to files</a><div class="cw-background" aria-hidden="true"><canvas id="cw-wave"></canvas><svg class="cw-fallback-wave" viewBox="0 0 1440 900" preserveAspectRatio="none"><path d="M-80 570C220 300 370 690 760 450S1260 290 1510 510"/><path d="M-80 540C220 640 400 330 820 470S1240 620 1510 360"/></svg></div>
<header class="cw-top"><a class="cw-brand" data-cw-navigation${navigationData(context, "", context.hrefForDirectory(""))} href="${escapeHtml(context.hrefForDirectory(""))}">${escapeHtml(project.name)}<span>Crosswave</span></a><nav class="cw-location" aria-label="Location"><a data-cw-navigation${navigationData(context, "", context.hrefForDirectory(""))} href="${escapeHtml(context.hrefForDirectory(""))}">Home</a>${breadcrumbs ? `<span class="cw-separator" aria-hidden="true">/</span>${breadcrumbs}` : ""}</nav><time class="cw-clock" aria-label="Current time" hidden></time></header>
<main class="cw-stage" data-cw-root="${escapeHtml(context.hrefForDirectory(""))}" data-cw-path="${escapeHtml(directory.current.relativePath)}" data-cw-page="${escapeHtml(context.assetHref(pageAsset(directory.current.relativePath)))}" data-cw-file="${escapeHtml(context.outputName)}"><h1 class="cw-sr">Files in ${escapeHtml(path)}</h1><nav class="cw-rail" aria-label="File categories" hidden><div class="cw-categories" role="tablist" aria-label="File categories">${tabs}</div></nav>
<section class="cw-browser" id="cw-panel" aria-label="Files"><div class="cw-list-head"><div class="cw-directory">${parent === null ? '<span class="cw-parent-placeholder"></span>' : `<a class="cw-parent" data-cw-parent data-cw-navigation${navigationData(context, directory.parent?.relativePath ?? "", parent)} href="${escapeHtml(parent)}" aria-label="Parent directory">${crosswaveIcon("back")}</a>`}<h2 data-cw-heading>All files</h2><span data-cw-count>${directory.entries.length} items</span></div><div class="cw-search" hidden>${crosswaveIcon("search")}<label class="cw-sr" for="cw-search">Search this folder</label><input id="cw-search" type="search" placeholder="Search this folder" autocomplete="off" spellcheck="false"><button type="button" data-cw-clear hidden>Clear</button></div></div>
<div class="cw-list-scroll"><ul class="cw-files">${directory.entries.map((entry, i) => row(entry, context, i)).join("")}</ul><p class="cw-empty" data-cw-empty${directory.entries.length ? " hidden" : ""}>${directory.entries.length ? "No files match this search." : "This folder is empty."}</p></div><p class="cw-sr" role="status" aria-live="polite" data-cw-status></p></section>
<aside class="cw-detail" aria-label="Selected file details" hidden><div class="cw-detail-symbol" data-cw-detail-icon></div><h2 data-cw-detail-name></h2><p data-cw-detail-status></p><dl><div><dt>Path</dt><dd data-cw-detail-path></dd></div><div><dt>Size</dt><dd data-cw-detail-size></dd></div><div><dt>Modified</dt><dd data-cw-detail-modified></dd></div></dl><a class="cw-open" data-cw-open>Open file</a></aside></main>
<footer class="cw-bottom"><span class="cw-key-help" hidden><span><kbd>Arrow keys</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Backspace</kbd> Parent</span></span><span class="cw-controller" role="status" hidden>${crosswaveIcon("controller")}<span data-cw-controller-label></span></span><div class="cw-appearance" hidden><label class="cw-sr" for="cw-color">Background color</label><select id="cw-color" aria-label="Background color"><option value="azure">Azure</option><option value="violet">Violet</option><option value="amber">Amber</option><option value="rose">Rose</option><option value="jade">Jade</option><option value="graphite">Graphite</option></select><button data-cw-motion aria-pressed="false" type="button">${crosswaveIcon("pause")}<span>Pause waves</span></button></div></footer><noscript><p class="cw-noscript">All files are available below. Categories, search, animated waves, and controller navigation need JavaScript.</p></noscript></body></html>`;
      const asset = pageAsset(directory.current.relativePath);
      const payload = JSON.stringify({
        version: 1,
        id: asset,
        path: directory.current.relativePath,
        outputName: context.outputName,
        baseHref: context.documentBaseHref,
        html,
      });
      return {
        html,
        assets: {
          "crosswave.css": crosswaveStyles,
          "crosswave.js": runtime,
          [asset]: `window.dispatchEvent(new CustomEvent("dirwell:crosswave-page",{detail:${payload}}));`,
        },
      };
    },
  };
}
