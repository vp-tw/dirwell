---
title: Themes
description: Layer typed components or replace the complete Dirwell renderer.
---

Themes own HTML, CSS, icons, and optional browser behavior. Tokens alone are not
the customization boundary.

## Plain theme

Use `createPlainTheme()` for complete browser-native listings with no icons,
JavaScript, appearance controls, or generated search index:

```ts
import { createPlainTheme, defineConfig } from "dirwell";

export default defineConfig({
  theme: createPlainTheme(),
});
```

The theme emits the complete list in both SSG and MPA modes. It shows symlink
targets and availability, preserves safe navigation and URL strategies, and
opens files outside the explorer in new tabs. It does not virtualize very large
directories; use the default theme when client-side search or virtualization is
needed. See the [plain example](../examples/).

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
