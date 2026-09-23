---
title: Themes
description: Layer typed components or replace the complete Dirwell renderer.
---

Themes own HTML, CSS, icons, and optional browser behavior. Tokens alone are not
the customization boundary.

## Component overrides

The default theme exposes eight stable components: `PageShell`, `Breadcrumbs`,
`Toolbar`, `EntryList`, `EntryRow`, `EmptyState`, `Footer`, and `Icon`.

```ts
import { createDefaultTheme, defineConfig } from "dirwell";

export default defineConfig({
  theme: createDefaultTheme({
    project: {
      author: "Your name",
      repositoryUrl: "https://github.com/you/project",
      license: "MIT License",
      licenseUrl: "https://github.com/you/project/blob/main/LICENSE",
    },
    components: {
      Footer: ({ parentHref }) =>
        parentHref === null ? "<footer>Home</footer>" : "<footer>Nested</footer>",
    },
  }),
});
```

Pass an array to layer a shared theme and site-specific overrides. Later layers
win.

## Wrapping a default component

Import a default component explicitly, then call it inside the override. This is
Dirwell's equivalent of Docusaurus `wrap`, without virtual aliases.

```ts
import { defaultThemeComponents } from "dirwell";

const components = {
  EntryRow: (props) => `<div class="company-row">${defaultThemeComponents.EntryRow(props)}</div>`,
};
```

Component functions return HTML, so use the exported `escapeHtml` helper for
untrusted text. A complete `ExplorerTheme` can use Svelte, Astro, React, or any
other server renderer.
