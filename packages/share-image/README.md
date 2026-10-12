# @dirwell/share-image

Optional build-time metadata and 1200 × 630 PNG images. Install this package only when share metadata or image rendering is needed. Core, Plain and the rich themes do not depend on it.

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

This is a static-build provider. No server image route or runtime image service is implied. All packages remain private until publication setup is completed.
