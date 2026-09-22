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
import { createDefaultTheme, defineConfig } from "dirwell";

export default defineConfig({
  theme: createDefaultTheme({
    components: {
      Footer: ({ parentHref }) =>
        parentHref === null ? "<footer>Home</footer>" : "<footer>Nested</footer>",
    },
  }),
});
```

Default components are exported as `defaultThemeComponents`, so a replacement
can wrap one explicitly. This provides the useful part of Docusaurus swizzling
without virtual aliases or unsafe component categories.

Component props and names are public API. Components receive prepared
filesystem data and navigation decisions; they do not read the filesystem.
Escape untrusted file names with the exported `escapeHtml` helper.

The full `ExplorerTheme` contract can host a Svelte, Astro, React, or other SSR
adapter that returns a complete HTML string and optional assets.
