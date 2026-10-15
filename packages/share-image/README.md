# @dirwell/share-image

Requires Node.js 22.12 or later. [Read the guide](https://vp-tw.github.io/dirwell/metadata/).

Optional build-time metadata and 1200 × 630 PNG images. Install this package only when share metadata or image rendering is needed. Core, Plain and the rich themes do not depend on it.

## Save a share image

```sh
npm install @dirwell/share-image@0.0.3
```

Save this as `image.mjs`, then run `node image.mjs`:

```js
import { writeFile } from "node:fs/promises";
import { createShareImage } from "@dirwell/share-image";
const image = await createShareImage({
  theme: "plain",
  title: "Sample downloads",
  description: "Release files and reports",
});
await writeFile("share.png", new Uint8Array(await image.arrayBuffer()));
```

The result is a local 1200 × 630 PNG. No explorer build or browser runtime is required.

## Add metadata to an explorer

```sh
npm install @dirwell/core@0.0.3 @dirwell/theme-plain@0.0.3 @dirwell/share-image@0.0.3
```

Create `files/note.txt`, save the following as `build.mjs` and run `node build.mjs`. Serve the complete `public/downloads` folder over HTTP; its pages reference the generated metadata/image assets.

```js
import { generateExplorer } from "@dirwell/core";
import { createPlainTheme } from "@dirwell/theme-plain";
import { createMetadataProvider } from "@dirwell/share-image";

await generateExplorer({
  sourceDir: "files",
  outputDir: "public/downloads",
  theme: createPlainTheme(),
  metadata: createMetadataProvider(
    { siteName: "Sample downloads", siteUrl: "https://example.com/downloads/" },
    { siteName: "Sample downloads", repositoryName: "example/files", imageTheme: "plain" },
  ),
});
```

Omit `imageTheme` for text-only metadata. `image: false` disables any preset; a local File/path/file URL or async callback supplies a custom image. `createShareImage({ theme, title, description })` returns a PNG File. Rendering is lazy, uses bundled Adobe fonts by default or the supplied local fonts described below, and retains at most 32 rendered PNGs per process. No network/system-font lookup occurs. The selected fonts must cover every displayed character; unsupported text fails instead of silently emitting missing glyphs. Supply a licensed local font for other scripts, or use a separate renderer when the required shaping is outside your qualified workload. Per-build image loading is deduplicated; image output paths are validated and conflicting bytes are rejected.

This is a static-build provider. No server image route or runtime image service is implied.

The 0.0.x API may evolve. Pin your qualified version and upgrade the official family together. See [support and verification](https://vp-tw.github.io/dirwell/support/) for host, browser and device boundaries.

## Custom local fonts (0.0.2)

Supply a licensed single-face TTF or OTF file with coverage for every displayed character. Paths resolve from the process cwd; local file URLs also work. A body font supplies both roles unless a headline font is specified. Font files are read for each call, limited to 32 MiB each, and their byte digests invalidate the 32-image cache. No font is downloaded and no system font is consulted.

```js
const image = await createShareImage({
  theme: "ledger",
  title: "資料下載",
  description: "Release files",
  fonts: { body: new URL("./fonts/MyLicensedFont.ttf", import.meta.url) },
});
```

Custom text is shaped and outlined from the supplied bytes. Missing glyphs fail with the role and Unicode code point; no silent fallback is used. Collections, WOFF/WOFF2 and remote URLs are unsupported. Use a complete font for your text; the repository's renamed OFL test subset is deliberately limited. To use the image in metadata, pass the resulting `File` through `createMetadataProvider({ image, ... })`, or call the renderer from an async image callback. Complex-script/emoji rendering beyond the qualified Latin/CJK workload requires your own qualification.
