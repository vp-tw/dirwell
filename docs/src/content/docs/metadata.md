---
title: Page metadata and share images
description: Set page titles, descriptions, and static or per-folder share images.
---

The three built-in themes provide page titles, descriptions, and one static 1200×630 share image per site. Each image uses its theme's colors and bundled Source font family, with repository name and theme name above the site title.

## Start with a site name

```ts
import { defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  root: "files",
  metadata: {
    siteName: "Downloads",
    repositoryName: "your-name/your-repo",
    siteUrl: "https://example.com/downloads/",
  },
});
```

The homepage title is `Downloads`; a child page is `docs · Downloads`. The default description uses whole-site totals, such as `3 folders · 6 files`, and is reused across pages. The share image stays the same while browsing folders. Rebuilding refreshes its totals.

If omitted, site and repository names come from the built-in theme's `project` settings. `metadata.siteName` controls page/image naming; `project.name` still controls theme chrome. Set both when you want them to match. Theme names appear in the image's upper-right corner rather than page titles.

Set `siteUrl` to the actual deployed explorer root, including its deployment base. Dirwell emits absolute `og:image`, `og:url`, and canonical URLs when it is provided. Without it, image links remain portable relative URLs and canonical/og:url are omitted; set it before relying on social preview crawlers. A repository URL is not a deployment URL. Social platforms may cache previews independently of your build.

## Counting folders, files, and links

The order is folders, files, links. Zero counts are omitted; all zero becomes `Empty folder`.

- `site` counts the selected source tree recursively, after include/exclude rules. The root itself and generated HTML, fonts, search assets, and images are excluded. Preserved source HTML remains a source file.
- `directory` counts immediate displayed entries, without descendants or the parent-navigation row.
- A symbolic link counts once as a link, regardless of target type or availability. Following it does not count its target again in site totals. Broken links still count as links; the file list displays their status.
- Hard-linked source files count by listed path, as ordinary files. Special filesystem entries do not contribute to these three counts.

## Fixed text and an existing image

```ts
metadata: {
  title: 'Design kit',
  description: 'Brand assets and reference documents',
  image: {
    source: './cover.png',
    outputPath: 'og/cover.png',
    alt: 'Design kit cover',
  },
}
```

A fixed title is used on every page. Fixed title/description values also feed the default generated image when you leave `image` unset. Text callbacks affect page metadata; the default image remains a whole-site image. To create per-folder images, provide an image callback.

`image` accepts a Node `File`, a local path string, a `file:` URL, or `{ source, outputPath?, alt? }`. Local path strings resolve from the config/project directory; programmatic generation can set `metadataBaseDirectory` explicitly, otherwise it uses the working directory. Remote image downloads are not performed. Supported image filename extensions are PNG, JPEG, WebP, and GIF.

`File.name` is a filename hint, not a source path or published output path. Without `outputPath`, Dirwell uses a content hash under `__dirwell/metadata/` and deduplicates identical images. Explicit paths are relative to the generated output root and must not overlap source entries, theme output, or reserved internal assets. Different bytes at the same explicit path fail the build. Use a separate `og/` directory. Set `image: false` to disable image generation while retaining text metadata.

## Generate an image per folder

```ts
import { createShareImage, describeContent } from '@vp-tw/dirwell';

metadata: {
  siteName: 'Design kit',
  description: ({ directory }) => describeContent(directory),
  image: async ({ directory, site, description }) => ({
    source: await createShareImage({
      theme: 'crosswave',
      repositoryName: site.repositoryName,
      title: directory.relativePath || site.name,
      description,
      directoryPath: directory.relativePath,
    }),
    outputPath: `og/${directory.relativePath || 'root'}.png`,
  }),
}
```

[Open the dynamic example](https://vp-tw.github.io/dirwell/examples/dynamic-og/) or inspect [its complete config](https://github.com/vp-tw/dirwell/tree/main/examples/dynamic-og). The small tree shows nested-folder results without a large demo library.

Title resolves first, then description, then the image callback receives both resolved strings. Callbacks may return promises and run at build time for each generated page. They receive public metadata, not absolute filesystem paths or owner IDs. A callback/image error stops generation before replacing the existing output.

## Fonts and custom themes

Ledger uses Source Sans 3 Regular, with Source Code Pro Regular for symlink target paths. Plain uses Source Serif 4 Regular. Crosswave uses Source Sans 3 Regular with Light for its brand title. WOFF2 files are served with each theme; PNG rendering uses pinned OTF sources with system-font discovery disabled. Normal builds need no font download. The source versions and SIL-OFL licenses ship in the package.

The bundled fonts support their upstream character repertoire; built-in text is English and no CJK font bundle or localization system is included. Use a custom image renderer/font set for languages outside that repertoire. Browser rasterization can differ across environments; pinning font files does not guarantee identical pixels on every device.

Custom themes can render `context.metadata?.head` inside their head element, or use its resolved title/description. Metadata does not inject HTML into arbitrary custom themes automatically. Ledger PageShell overrides receive `metadata` too. Crosswave updates managed metadata tags during persistent folder navigation, including browser history restoration.
