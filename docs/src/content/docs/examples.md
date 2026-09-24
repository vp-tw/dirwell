---
title: Examples
description: Pick a working build, inspect its config, and compare the result.
---

Open the example closest to your use case. Each item links to the live page
and the source directory that generates it.

- Portable folder: `basic` keeps SSG and relative URLs at their defaults.
  [Live page](https://vp-tw.github.io/dirwell/examples/basic/) ·
  [Source](https://github.com/vp-tw/dirwell/tree/main/examples/basic)
- Fixed project-site path: `base` uses `mode: "mpa"`, `base`, and
  `urls: "base"` for shared assets under a known prefix.
  [Live page](https://vp-tw.github.io/dirwell/examples/base/) ·
  [Source](https://github.com/vp-tw/dirwell/tree/main/examples/base)
- Completely different page: `custom-theme` renders a release catalog with
  its own HTML and CSS. [Live page](https://vp-tw.github.io/dirwell/examples/custom-theme/) ·
  [Source](https://github.com/vp-tw/dirwell/tree/main/examples/custom-theme)
- New colors and icons with the same explorer: `default-theme-override`
  uses Catppuccin Latte and Macchiato with `icons` and `components`.
  [Live page](https://vp-tw.github.io/dirwell/examples/default-theme-override/) ·
  [Source](https://github.com/vp-tw/dirwell/tree/main/examples/default-theme-override)
- Bundled file-type artwork: `file-icons` shows the unmodified default
  theme used on the homepage. [Live page](https://vp-tw.github.io/dirwell/examples/file-icons/) ·
  [Source](https://github.com/vp-tw/dirwell/tree/main/examples/file-icons)
- No-script list: `plain` uses `createPlainTheme()` and renders complete HTML.
  [Live page](https://vp-tw.github.io/dirwell/examples/plain/) ·
  [Source](https://github.com/vp-tw/dirwell/tree/main/examples/plain)

The source directories include their own `dirwell.config.ts` and input
`files/` trees. The documentation build reads those configs and passes them
as one array to `Dirwell([...])` in a Vite build. It writes each explorer to
`docs/public/examples/` before Astro copies them into the publish tree. The
homepage embeds the generated `file-icons` page, so its preview uses the same
HTML and assets as the live example.

## Build and inspect locally

From the repository root:

```bash
SITE_BASE=/dirwell/ pnpm run site:build
```

Open the resulting `site/examples/` directories with a local static server.
`SITE_BASE` sets the documentation base path; the `base` example uses it for
its generated links. For local iteration, `pnpm run docs:dev` builds the
examples, starts Astro, watches source and example files, and reloads the
embedded preview after a successful rebuild.

`PUBLIC_REPOSITORY_URL` controls the source links on the landing page.
GitHub Actions supplies the repository URL when it deploys Pages.
