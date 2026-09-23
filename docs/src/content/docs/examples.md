---
title: Examples
description: Compare complete Dirwell builds and inspect the source behind each one.
---

Each example is a real Dirwell input directory with its own configuration. The
documentation build generates the examples in `docs/public/examples/` before Astro
copies them into the publish tree. The landing-page preview embeds the generated
`file-icons` example, so its default-theme interface and assets are not duplicated
in the documentation source.

| Example        | What it proves                                                                      | Output                    |
| -------------- | ----------------------------------------------------------------------------------- | ------------------------- |
| `basic`        | The defaults produce a portable site without configuration.                         | SSG with relative URLs    |
| `base-path`    | Shared assets and file links work below a GitHub Pages repository path.             | MPA with base URLs        |
| `custom-theme` | Typed component overrides can change product language without forking the renderer. | SSG with a layered theme  |
| `file-icons`   | The default theme self-hosts selected vscode-icons file-type artwork.               | SSG with bundled SVGs     |
| `plain`        | Plain HTML listings work without icons, JavaScript, or client-side search.          | SSG without search assets |

From the repository root, build the documentation and all examples together:

```bash
SITE_BASE=/repository-name/ pnpm run site:build
```

For local iteration, run `pnpm run docs:dev`. It builds the examples before
starting Astro, watches the Dirwell source and example inputs, and reloads the
embedded preview after a successful rebuild.

The command writes one publishable tree:

```text
site/
├── index.html
├── getting-started/
├── examples/
│   ├── basic/
│   ├── base-path/
│   ├── custom-theme/
│   ├── file-icons/
│   └── plain/
└── _astro/
```

`PUBLIC_REPOSITORY_URL` controls the source links on the landing page. GitHub
Actions sets it from `GITHUB_REPOSITORY`, so the website does not depend on a
hardcoded owner or final repository name.
