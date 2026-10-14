# @dirwell/share-image

Requires Node.js 22.12 or later. [Read the guide](https://vp-tw.github.io/dirwell/metadata/).

Optional build-time metadata and 1200 × 630 PNG images. Install this package only when share metadata or image rendering is needed. Core, Plain and the rich themes do not depend on it.

## Save a share image

```sh
npm install @dirwell/share-image@0.0.1
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
npm install @dirwell/core@0.0.1 @dirwell/theme-plain@0.0.1 @dirwell/share-image@0.0.1
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

Omit `imageTheme` for text-only metadata. `image: false` disables any preset; a local File/path/file URL or async callback supplies a custom image. `createShareImage({ theme, title, description })` returns a PNG File. Rendering is lazy, uses bundled Adobe fonts without network/system-font lookup, and retains at most 32 rendered PNGs per process. The existing renderer requires bundled glyph coverage; unsupported text fails instead of silently emitting missing glyphs. Use a custom renderer for other scripts. Per-build image loading is deduplicated; image output paths are validated and conflicting bytes are rejected.

This is a static-build provider. No server image route or runtime image service is implied.
