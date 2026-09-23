# Theme architecture

Dirwell themes own the complete document, styles, icons, and optional browser
behavior. Tokens are an implementation detail of a theme, not the customization
boundary.

## Component layers

Use an `ExplorerTheme` to replace the complete renderer. Use component layers
to replace selected parts of the default theme: `PageShell`, `Breadcrumbs`,
`Toolbar`, `EntryList`, `EntryRow`, `EmptyState`, `Footer`, and
`Icon`.

Each component is a typed function from props to HTML. Layers resolve from left
to right:

```ts
import { createDefaultTheme, defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  theme: createDefaultTheme({
    globalSearch: true,
    sorting: true,
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

Global search is progressive: the browser requests the generated JSON index
only after the user selects `Everywhere`. Sorting and search controls can be
disabled independently without changing the component override API.

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
adapter that returns a complete HTML string and optional assets.
