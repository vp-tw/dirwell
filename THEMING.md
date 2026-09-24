# Theme architecture

Dirwell themes own the complete document, styles, icons, and optional browser
behavior. Choose one of three paths:

| Need                                                | Use                                       | Keep                            |
| --------------------------------------------------- | ----------------------------------------- | ------------------------------- |
| Change controls, colors, icons, or a few HTML parts | `createDefaultTheme(options)`             | Default explorer behavior       |
| Publish a basic no-script list                      | `createPlainTheme()`                      | Prepared entries and safe links |
| Replace the full page                               | An `ExplorerTheme` with `render(context)` | Prepared entries and safe links |

The [theme guide](docs/src/content/docs/themes.md) lists every default-theme
option, its accepted input, default, result, and use case. This file describes
the component contract for theme authors.

## Component layers

Use an `ExplorerTheme` to replace the complete renderer. Use component layers
to replace selected parts of the default theme: `PageShell`, `Breadcrumbs`,
`Toolbar`, `EntryList`, `EntryRow`, `EmptyState`, `Footer`, and
`Icon`.

Each component is a typed function from props to HTML. Pass one override object
or an array of layers. Later layers win when they define the same component:

```ts
import { createDefaultTheme, defineConfig } from "dirwell";

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
only after the user selects `Everywhere`. Sorting and search controls can be
disabled independently without changing the component override API.

Replacing `EntryList` or `EntryRow` disables the default MPA virtual list.
Keep those defaults for large directories unless the replacement provides its
own row loading. `virtualizeAfter` defaults to 500 entries.

Within the bundled theme, the five select controls share a private renderer,
and `--dw-control-height` gives search, select, sort, and color-scheme controls
one height. This is a default-theme styling hook, not a requirement for custom
themes. The controls keep their native `input`, `select`, `details`, and
`fieldset` semantics; override `Toolbar` to replace their markup.

The bundled explorer has its own [design specification](src/theme-default/DESIGN.md)
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
[`custom-theme`](examples/custom-theme) example builds a release catalog with
its own HTML and CSS. The [`default-theme-override`](examples/default-theme-override)
example keeps the default explorer and changes components, Catppuccin colors,
and file icons. `createDefaultTheme({ icons })` accepts light and optional dark
SVG sets, including fallbacks and extension mappings. Dirwell uses the same icon
set for static, global-search, and virtualized rows.
