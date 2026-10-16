import { formatBytes, sizeValue } from "../../core/src/format.ts";
import { escapeHtml } from "../../core/src/html.ts";
import type { ListingEntry } from "../../core/src/listing.ts";
import type { ResolvedThemeCustomization } from "./customization.ts";

/** Official-theme markup only. Independent themes can use raw bytes or the public formatter. */
export function renderSize(entry: ListingEntry, ui: ResolvedThemeCustomization): string {
  const { symlink = "both", exact = "details", ...format } = ui.size;
  const lines: { label: string; bytes: number | null; text: string }[] = [];
  const directory = entry.kind === "directory";
  if (directory) return `<span class="dw-size-folder">${escapeHtml(ui.labels.folder)}</span>`;
  const add = (label: string, bytes: number | null, folder = false) =>
    lines.push({
      label,
      bytes,
      text: folder
        ? ui.labels.folder
        : bytes === null
          ? ui.labels.sizeUnavailable
          : formatBytes(bytes, format),
    });
  if (entry.kind === "symlink") {
    if (symlink !== "entry")
      add(
        ui.labels.sizeTarget,
        sizeValue(entry),
        !entry.link?.unavailable && entry.link?.targetKind === "directory",
      );
    if (symlink !== "target") add(ui.labels.sizeLink, sizeValue(entry, "entry"));
  } else add("", sizeValue(entry, "entry"));
  const summary = `<span class="dw-size-values">${lines.map(({ label, text }) => `<span class="dw-size-line">${label ? `<span class="dw-size-label">${escapeHtml(label)}</span> ` : ""}<span class="dw-size-value">${escapeHtml(text)}</span></span>`).join('<span class="dw-size-separator"> · </span>')}</span>`;
  const known = lines.filter((line) => line.bytes !== null);
  if (exact === "none" || format.units === "bytes" || known.length === 0)
    return `<span class="dw-size">${summary}</span>`;
  const full = known
    .map(
      ({ label, bytes }) =>
        `<span class="dw-size-line">${label ? `${escapeHtml(label)} ` : ""}${escapeHtml(formatBytes(bytes ?? 0, { units: "bytes", locale: format.locale ?? "en-US" }))}</span>`,
    )
    .join('<span class="dw-size-separator"> · </span>');
  if (exact === "inline")
    return `<span class="dw-size">${summary}<span class="dw-size-exact">${full}</span></span>`;
  return `<details class="dw-size"><summary aria-label="${escapeHtml(`${ui.labels.exactSize}: ${entry.name}. ${lines.map((line) => `${line.label} ${line.text}`).join("; ")}`)}">${summary}</summary><span class="dw-size-exact">${full}</span></details>`;
}
