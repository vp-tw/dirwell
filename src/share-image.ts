import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { create, type Font } from "fontkit";
import { Resvg } from "@resvg/resvg-js";

export interface ShareImageOptions {
  readonly theme?: "ledger" | "plain" | "crosswave";
  readonly title: string;
  readonly description: string;
  readonly repositoryName?: string;
  readonly directoryPath?: string;
}
const fontNames = [
  "SourceSans3-Regular.otf",
  "SourceSans3-Light.otf",
  "SourceSerif4-Regular.otf",
] as const;
const buffers = await Promise.all(
  fontNames.map((name) => readFile(new URL(`./fonts/${name}`, import.meta.url))),
);
const fonts = buffers.map((bytes) => create(bytes) as Font);
const fontDigest = createHash("sha256").update(Buffer.concat(buffers)).digest("hex");
const themes = {
  ledger: {
    name: "Ledger",
    face: 0,
    family: "Source Sans 3",
    bg: "#f3f0e8",
    fg: "#171815",
    muted: "#64655f",
    rule: "#c9c5ba",
    weight: 400,
  },
  plain: {
    name: "Plain",
    face: 2,
    family: "Source Serif 4",
    bg: "#ffffff",
    fg: "#171815",
    muted: "#454545",
    rule: "#171815",
    weight: 400,
  },
  crosswave: {
    name: "Crosswave",
    face: 1,
    family: "Source Sans 3",
    bg: "#091a3a",
    fg: "#f7fbff",
    muted: "#edf4fc",
    rule: "#edf4fc",
    weight: 300,
  },
} as const;
const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
function escape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function width(text: string, face: number, size: number): number {
  const font = fonts[face]!;
  return (
    (font.layout(text).positions.reduce((sum, position) => sum + position.xAdvance, 0) * size) /
    font.unitsPerEm
  );
}
function fit(
  value: string,
  face: number,
  sizes: readonly number[],
  limit: number,
  maxLines = 2,
): { size: number; lines: string[] } {
  if (typeof value !== "string") throw new TypeError("Share image text must be a string");
  const text = Array.from(
    segmenter.segment(value.slice(0, 16384).normalize("NFC").replace(/\s+/g, " ").trim()),
    (part) => part.segment,
  );
  const bounded = text.slice(0, 2048);
  for (const character of bounded.join("")) {
    const codePoint = character.codePointAt(0)!;
    if (!fonts[face]!.hasGlyphForCodePoint(codePoint))
      throw new Error(
        `Bundled share-image font lacks U+${codePoint.toString(16).toUpperCase()}; use a custom image renderer or metadata.image: false`,
      );
  }
  for (const size of sizes) {
    let position = 0;
    const lines: string[] = [];
    while (position < bounded.length && lines.length < maxLines) {
      let low = 0,
        high = bounded.length - position;
      while (low < high) {
        const count = Math.ceil((low + high) / 2);
        if (width(bounded.slice(position, position + count).join(""), face, size) <= limit)
          low = count;
        else high = count - 1;
      }
      const end = position + Math.max(1, low);
      let line = bounded.slice(position, end).join("").trim();
      if (lines.length === maxLines - 1 && (end < text.length || value.length > 16384)) {
        let graphemes = Array.from(segmenter.segment(line), (part) => part.segment);
        while (graphemes.length && width(graphemes.join("") + "…", face, size) > limit)
          graphemes.pop();
        line = graphemes.join("") + "…";
      }
      lines.push(line);
      position = end;
    }
    if (position >= text.length || size === sizes.at(-1)) return { size, lines };
  }
  return { size: 56, lines: [] };
}
function text(
  value: { size: number; lines: string[] },
  x: number,
  y: number,
  gap: number,
  fill: string,
  family: string,
  weight = 400,
  anchor = "start",
): string {
  return value.lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * gap}" font-family="${family}" font-weight="${weight}" font-size="${value.size}" fill="${fill}" text-anchor="${anchor}">${escape(line)}</text>`,
    )
    .join("");
}
const wave = `<defs><linearGradient id="bg" x2=".2" y2="1"><stop stop-color="#2b4f85"/><stop offset="1" stop-color="#091a3a"/></linearGradient><linearGradient id="ribbon"><stop stop-color="#80afff" stop-opacity=".02"/><stop offset=".5" stop-color="#b7d6ff" stop-opacity=".24"/><stop offset="1" stop-color="#e6f2ff" stop-opacity=".03"/></linearGradient></defs><rect width="1200" height="630" fill="url(#bg)"/><path d="M-80 470C170 270 330 560 630 435S980 290 1280 470" stroke="url(#ribbon)" stroke-width="32" fill="none"/><path d="M-80 495C170 590 370 315 690 465S1020 580 1280 390" stroke="url(#ribbon)" stroke-width="14" fill="none"/>`;
const cache = new Map<string, File>();
/** Build-time PNG generation with bundled fonts; no network or system-font search. */
export function renderShareImage(options: ShareImageOptions): File {
  const theme = options.theme ?? "ledger";
  const t = themes[theme];
  if (!t) throw new TypeError("Unknown share image theme");
  const regular = theme === "plain" ? 2 : 0;
  const headline = fit(options.title, t.face, [96, 88, 80, 72, 64, 56], 1064);
  const header = fit(options.repositoryName ?? "", regular, [30, 28, 26], 800, 1);
  const description = fit(options.description, regular, [34, 30, 26], 1064, 1);
  const directory = fit(
    options.directoryPath ? `/${options.directoryPath}/` : "",
    regular,
    [24],
    1064,
    1,
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${t.bg}"/>${theme === "crosswave" ? wave : ""}${text(header, 68, 86, 0, t.fg, t.family)}${text({ size: 30, lines: [t.name] }, 1130, 86, 0, t.fg, t.family, 400, "end")}${theme === "crosswave" ? "" : `<path d="M64 126H1136" stroke="${t.rule}"/>`}${text(headline, 68, 276, 112, t.fg, t.family, t.weight)}${text(description, 68, 480, 0, t.muted, t.family)}${text(directory, 68, 572, 0, t.muted, t.family)}</svg>`;
  const key = createHash("sha256").update(fontDigest).update(svg).digest("hex");
  const previous = cache.get(key);
  if (previous) return previous;
  const png = new Resvg(svg, {
    font: {
      fontFiles: fontNames.map((name) =>
        fileURLToPath(new URL(`./fonts/${name}`, import.meta.url)),
      ),
      loadSystemFonts: false,
    },
  })
    .render()
    .asPng();
  const file = new File([new Uint8Array(png)], `${theme}.png`, { type: "image/png" });
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  cache.set(key, file);
  return file;
}
