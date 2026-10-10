# Theme architecture

Dirwell themes own the complete document, styles, icons, and optional browser
behavior. Choose one of three paths:

| Need                                                | Use                                       | Keep                            |
| --------------------------------------------------- | ----------------------------------------- | ------------------------------- |
| Change controls, colors, icons, or a few HTML parts | `createDefaultTheme(options)`             | Default explorer behavior       |
| Publish a basic no-script list                      | `createPlainTheme()`                      | Prepared entries and safe links |
| Replace the full page                               | An `ExplorerTheme` with `render(context)` | Prepared entries and safe links |

The [theme guide](https://vp-tw.github.io/dirwell/themes/) lists every default-theme
option, its accepted input, default, result, and use case. This file describes
the component contract for theme authors.

## Crosswave renderer

`createCrosswaveTheme()` provides an independent, PSP-inspired renderer with
category navigation, local search, ribbon light, and optional controller input.
Its styles, assets, and runtime are separate from Ledger. See [Crosswave](https://vp-tw.github.io/dirwell/themes/#crosswave)
for options, keyboard behavior, browser transition support, and hardware-test limits.

Crosswave’s header links to its theme documentation and to VdustR, its author.
`project.name` controls your site’s display name; it does not rename the theme
or change its author credit. The example’s “Media Library” is a configured site
name, not a built-in media player or preview feature.

## Component layers

Use an `ExplorerTheme` to replace the complete renderer. Use component layers
to replace selected parts of the default theme: `PageShell`, `Breadcrumbs`,
`Toolbar`, `EntryList`, `EntryRow`, `EmptyState`, `Footer`, and
`Icon`.

Each component is a typed function from props to HTML. Pass one override object
or an array of layers. Later layers win when they define the same component:

```ts
import { createDefaultTheme, defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  theme: createDefaultTheme({
    globalSearch: true,
    sorting: true,
    project: {
      author: "Your name",
      authorUrl: "https://github.com/you",
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

Global search is progressive: the browser requests the generated JSON index
only after the user opens Search all files and types a query. Sorting and search controls can be
disabled independently without changing the component override API.

Replacing `EntryList` or `EntryRow` disables the default MPA virtual list.
Keep those defaults for large directories unless the replacement provides its
own row loading. `virtualizeAfter` defaults to 500 entries.

Within the bundled theme, select controls share a private renderer,
and `--dw-control-height` gives search, select, sort, and color-scheme controls
one height. This is a default-theme styling hook, not a requirement for custom
themes. The controls keep their native `input`, `select`, `details`, and
`fieldset` semantics; override `Toolbar` to replace their markup.

The bundled explorer has its own [design specification](https://github.com/vp-tw/dirwell/blob/main/src/theme-default/DESIGN.md)
beside its components and styles. The repository-root `DESIGN.md` describes the
official site; neither document constrains third-party themes.

Default components are exported as `defaultThemeComponents`, so a replacement
can wrap one explicitly. This provides the useful part of Docusaurus swizzling
without virtual aliases or unsafe component categories.

Component props and names are public API. Components receive prepared
filesystem data and navigation decisions; they do not read the filesystem.
Escape untrusted file names with the exported `escapeHtml` helper.

The full `ExplorerTheme` contract can host a Svelte, Astro, React, or other SSR
adapter that returns a complete HTML string and optional assets. The
[`custom-theme`](https://github.com/vp-tw/dirwell/tree/main/examples/custom-theme) example builds a release catalog with
its own HTML and CSS. The [`default-theme-override`](https://github.com/vp-tw/dirwell/tree/main/examples/default-theme-override)
example keeps the default explorer and changes components, Catppuccin colors,
and file icons. `createDefaultTheme({ icons })` accepts light and optional dark
SVG sets, including fallbacks and extension mappings. Dirwell uses the same icon
set for static, global-search, and virtualized rows.

## Independent alpha packages

An external package can return `ExplorerTheme` through its own factory and own
its HTML, assets, styles, options, and localization. Pin the tested Dirwell alpha
in its peer dependency. See [the package contract](THEME_PACKAGE_CONTRACT.md)
and [the separately packed example](https://github.com/vp-tw/dirwell/tree/main/examples/theme-package).
