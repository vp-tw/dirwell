---
title: Examples
description: Compare complete Dirwell builds and inspect the source behind each one.
---

Each example is a real Dirwell input directory with its own configuration. The
documentation build publishes every generated explorer below the same site base.

| Example        | What it proves                                                                      | Output                    |
| -------------- | ----------------------------------------------------------------------------------- | ------------------------- |
| `basic`        | The defaults produce a portable site without configuration.                         | SSG with relative URLs    |
| `base-path`    | Shared assets and file links work below a GitHub Pages repository path.             | MPA with base URLs        |
| `custom-theme` | Typed component overrides can change product language without forking the renderer. | SSG with a layered theme  |
| `plain`        | Plain HTML listings work without icons, JavaScript, or client-side search.          | SSG without search assets |

From the repository root, build the documentation and all examples together:

```bash
SITE_BASE=/repository-name/ pnpm run site:build
```

The command writes one publishable tree:

```text
site/
├── index.html
├── getting-started/
├── examples/
│   ├── basic/
│   ├── base-path/
│   ├── custom-theme/
│   └── plain/
└── _astro/
```

`PUBLIC_REPOSITORY_URL` controls the source links on the landing page. GitHub
Actions sets it from `GITHUB_REPOSITORY`, so the website does not depend on a
hardcoded owner or final repository name.
