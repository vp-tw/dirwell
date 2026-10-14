import { escapeHtml } from "@dirwell/core";
import { readFile, open } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { create, type Font } from "fontkit";
import { Resvg } from "@resvg/resvg-js";

export interface ShareImageFonts {
  readonly body?: string | URL;
  readonly headline?: string | URL;
}
export interface ShareImageOptions {
  readonly fonts?: ShareImageFonts;
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

interface ImageFace {
  readonly font: Font;
  readonly custom: boolean;
  readonly role: "body" | "headline";
}
async function loadFace(source: string | URL, role: ImageFace["role"]) {
  if (
    (typeof source !== "string" && !(source instanceof URL)) ||
    (typeof source === "string" && (!source || /^[a-z][a-z0-9+.-]*:\/\//i.test(source))) ||
    (source instanceof URL &&
      (source.protocol !== "file:" || (source.hostname && source.hostname !== "localhost")))
  )
    throw new TypeError(`fonts.${role} must be a local path or file URL`);
  const handle = await open(source, "r").catch((cause: unknown) => {
    throw new TypeError(`Cannot read fonts.${role}`, { cause });
  });
  let bytes: Buffer;
  try {
    const stats = await handle.stat();
    if (!stats.isFile()) throw new TypeError(`fonts.${role} must refer to a regular font file`);
    const size = stats.size;
    if (size < 12) throw new TypeError(`fonts.${role} must contain a valid TTF or OTF header`);
    if (size > 32 * 1024 * 1024) throw new TypeError(`fonts.${role} must be at most 32 MiB`);
    const bounded = Buffer.alloc(size + 1);
    let received = 0;
    while (received < bounded.length) {
      const result = await handle.read(bounded, received, bounded.length - received, null);
      if (!result.bytesRead) break;
      received += result.bytesRead;
    }
    if (received !== size) throw new TypeError(`fonts.${role} changed while being read`);
    bytes = bounded.subarray(0, received);
  } finally {
    await handle.close();
  }
  if (bytes.readUInt32BE(0) !== 0x00010000 && bytes.toString("ascii", 0, 4) !== "OTTO")
    throw new TypeError(`fonts.${role} must be a single TTF or OTF font`);
  let font: Font;
  try {
    font = create(bytes) as Font;
    if (
      typeof font.layout !== "function" ||
      !Number.isFinite(font.unitsPerEm) ||
      font.unitsPerEm <= 0
    )
      throw new TypeError("Invalid font metrics");
  } catch (cause) {
    throw new TypeError(`Invalid fonts.${role}`, { cause });
  }
  return { face: { font, custom: true, role } satisfies ImageFace, bytes };
}
function requireGlyphs(value: string, face: ImageFace) {
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    if (!face.font.hasGlyphForCodePoint(codePoint))
      throw new Error(
        `${face.custom ? `Share-image ${face.role}` : "Bundled share-image"} font lacks U+${codePoint.toString(16).toUpperCase()}; supply a font with glyph coverage or metadata.image: false`,
      );
  }
}
function width(text: string, face: ImageFace, size: number): number {
  const font = face.font;
  return (
    (font.layout(text).positions.reduce((sum, position) => sum + position.xAdvance, 0) * size) /
    font.unitsPerEm
  );
}
function fit(
  value: string,
  face: ImageFace,
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
  requireGlyphs(bounded.join(""), face);
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
        requireGlyphs(line, face);
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
  face?: ImageFace,
): string {
  if (face?.custom)
    return value.lines
      .map((line, index) => {
        requireGlyphs(line, face);
        const run = face.font.layout(line),
          scale = value.size / face.font.unitsPerEm;
        const total = run.positions.reduce((sum, position) => sum + position.xAdvance, 0);
        let advance = 0;
        const paths = run.glyphs
          .map((glyph, position) => {
            const offset = run.positions[position]!;
            const data = glyph.path.toSVG();
            const translatedX =
              x + (advance + offset.xOffset - (anchor === "end" ? total : 0)) * scale;
            advance += offset.xAdvance;
            return data
              ? `<path d="${data}" transform="translate(${translatedX} ${y + index * gap - offset.yOffset * scale}) scale(${scale} ${-scale})" fill="${fill}"/>`
              : "";
          })
          .join("");
        return paths;
      })
      .join("");
  return value.lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * gap}" font-family="${family}" font-weight="${weight}" font-size="${value.size}" fill="${fill}" text-anchor="${anchor}">${escapeHtml(line)}</text>`,
    )
    .join("");
}
const wave = `<defs><linearGradient id="bg" x2=".2" y2="1"><stop stop-color="#2b4f85"/><stop offset="1" stop-color="#091a3a"/></linearGradient><linearGradient id="ribbon"><stop stop-color="#80afff" stop-opacity=".02"/><stop offset=".5" stop-color="#b7d6ff" stop-opacity=".24"/><stop offset="1" stop-color="#e6f2ff" stop-opacity=".03"/></linearGradient></defs><rect width="1200" height="630" fill="url(#bg)"/><path d="M-80 470C170 270 330 560 630 435S980 290 1280 470" stroke="url(#ribbon)" stroke-width="32" fill="none"/><path d="M-80 495C170 590 370 315 690 465S1020 580 1280 390" stroke="url(#ribbon)" stroke-width="14" fill="none"/>`;
const cache = new Map<string, File>();
/** Build-time PNG generation with bundled or supplied local fonts; no network or system-font search. */
export async function renderShareImage(options: ShareImageOptions): Promise<File> {
  const theme = options.theme ?? "ledger";
  const t = themes[theme];
  if (!t) throw new TypeError("Unknown share image theme");
  if (
    options.fonts !== undefined &&
    (typeof options.fonts !== "object" ||
      options.fonts === null ||
      Array.isArray(options.fonts) ||
      Object.keys(options.fonts).some((key) => !["body", "headline"].includes(key)))
  )
    throw new TypeError("fonts must contain only body/headline local font paths");
  const body =
    options.fonts?.body === undefined ? null : await loadFace(options.fonts.body, "body");
  const customHeadline =
    options.fonts?.headline === undefined
      ? body
      : await loadFace(options.fonts.headline, "headline");
  const regular: ImageFace = body?.face ?? {
    font: fonts[theme === "plain" ? 2 : 0]!,
    custom: false,
    role: "body",
  };
  const headlineFace: ImageFace = customHeadline
    ? { ...customHeadline.face, role: "headline" }
    : { font: fonts[t.face]!, custom: false, role: "headline" };
  const digest = createHash("sha256")
    .update(
      JSON.stringify([
        fontDigest,
        body ? createHash("sha256").update(body.bytes).digest("hex") : null,
        customHeadline ? createHash("sha256").update(customHeadline.bytes).digest("hex") : null,
      ]),
    )
    .digest("hex");
  const headline = fit(options.title, headlineFace, [96, 88, 80, 72, 64, 56], 1064);
  const header = fit(options.repositoryName ?? "", regular, [30, 28, 26], 800, 1);
  const description = fit(options.description, regular, [34, 30, 26], 1064, 1);
  const directory = fit(
    options.directoryPath ? `/${options.directoryPath}/` : "",
    regular,
    [24],
    1064,
    1,
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${t.bg}"/>${theme === "crosswave" ? wave : ""}${text(header, 68, 86, 0, t.fg, t.family, 400, "start", regular)}${text({ size: 30, lines: [t.name] }, 1130, 86, 0, t.fg, t.family, 400, "end", regular)}${theme === "crosswave" ? "" : `<path d="M64 126H1136" stroke="${t.rule}"/>`}${text(headline, 68, 276, 112, t.fg, t.family, t.weight, "start", headlineFace)}${text(description, 68, 480, 0, t.muted, t.family, 400, "start", regular)}${text(directory, 68, 572, 0, t.muted, t.family, 400, "start", regular)}</svg>`;
  const key = createHash("sha256").update(digest).update(svg).digest("hex");
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
