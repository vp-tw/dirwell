---
title: Examples
description: Compare complete Dirwell builds and inspect the source behind each one.
---

Each example is a real Dirwell input directory with its own configuration. One
Vite build passes those configurations as an array to `Dirwell()` and generates
the explorers in `docs/public/examples/` before Astro copies them into the
publish tree. The landing-page preview embeds the generated
`file-icons` preview, so its default-theme interface and assets are not duplicated
in the documentation source. The preview remains available as a generated build.

| Example                  | What it proves                                                                                        | Output                           | Live demo                                                                     | Source code                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `basic`                  | The defaults produce a portable site.                                                                 | SSG with relative URLs           | [Open demo](https://vp-tw.github.io/dirwell/examples/basic/)                  | [GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/basic)                  |
| `base`                   | Shared assets and file links work below a configured base path.                                       | MPA with base URLs               | [Open demo](https://vp-tw.github.io/dirwell/examples/base/)                   | [GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/base)                   |
| `custom-theme`           | A complete theme controls its own HTML and CSS while reusing Dirwell's directory data and safe links. | SSG release catalog              | [Open demo](https://vp-tw.github.io/dirwell/examples/custom-theme/)           | [GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/custom-theme)           |
| `default-theme-override` | Catppuccin Latte and Macchiato replace colors and icons while selected components change.             | SSG with default-theme overrides | [Open demo](https://vp-tw.github.io/dirwell/examples/default-theme-override/) | [GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/default-theme-override) |
| `plain`                  | Plain HTML listings work without icons, JavaScript, or client-side search.                            | SSG without search assets        | [Open demo](https://vp-tw.github.io/dirwell/examples/plain/)                  | [GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/plain)                  |

The homepage's [default-theme preview](https://vp-tw.github.io/dirwell/examples/file-icons/)
uses [icon-rich source files](https://github.com/vp-tw/dirwell/tree/main/examples/file-icons).

From the repository root, build the documentation and all examples together:

```bash
SITE_BASE=/repository-name/ pnpm run site:build
```

For local iteration, run `pnpm run docs:dev`. It builds all explorers through
the Vite adapter before starting Astro, watches the Dirwell source and example
inputs, and reloads the embedded preview after a successful rebuild.

The command writes one publishable tree:

```text
site/
├── index.html
├── getting-started/
├── examples/
│   ├── basic/
│   ├── base/
│   ├── custom-theme/
│   ├── default-theme-override/
│   ├── file-icons/
│   └── plain/
└── _astro/
```

`PUBLIC_REPOSITORY_URL` controls the source links on the landing page. GitHub
Actions sets it from `GITHUB_REPOSITORY`, so the website does not depend on a
hardcoded owner or final repository name.
