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

Its footer identifies the repository, author, and license. Override the defaults
with `createPlainTheme({ project: { name, repositoryUrl, author, license, licenseUrl } })`.
The repository name becomes a link when `repositoryUrl` is configured; the
default project URL is intentionally not linked while the repository is unpublished.

## Component overrides

The default theme exposes eight stable components: `PageShell`, `Breadcrumbs`,
`Toolbar`, `EntryList`, `EntryRow`, `EmptyState`, `Footer`, and `Icon`.
The [Catppuccin example](../examples/) changes colors, file icons, and selected
components while retaining the default explorer behavior.

### File icons

`createDefaultTheme({ icons })` accepts SVG markup for a light icon set and an
optional dark set. Each set supplies fallback file and folder icons plus an
optional map from file extensions to SVG markup. Dirwell writes the SVGs into
the generated site and uses the same map for directory rows, global search, and
virtualized MPA rows. When a dark set is present, it follows the theme selector
and the system color scheme. Include an attribution notice when using third-party
icons; the generated footer links to it. See the
[Catppuccin configuration](https://github.com/vp-tw/dirwell/blob/main/examples/default-theme-override/dirwell.config.ts)
for a complete example.

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

## Build a complete theme

A complete theme is an object with a name and a `render(context)` function.
Dirwell prepares the directory entries and safe links; the function returns a
full HTML document and any named assets. This lets a site choose its own
markup, styles, icons, and browser behavior. The
[release catalog example](https://github.com/vp-tw/dirwell/tree/main/examples/custom-theme)
implements one without client-side JavaScript.
