# Theme architecture

Use the published SDK packages. CLI defaults to Plain; core and integrations take a theme explicitly. [The theme guide](docs/src/content/docs/themes.md) covers package selection and options.

Independent renderers implement `ExplorerTheme` from `@dirwell/core`, own the complete HTML and assets, and use context navigation helpers. They must escape source text, preserve the HTML base and keep private filesystem facts out of client data. See [the package contract](THEME_PACKAGE_CONTRACT.md).

To customize official rich themes, wrap `@dirwell/theme-ledger/source` in Svelte or `@dirwell/theme-crosswave/source` in Vue. Compile both SSR and client output using `@dirwell/theme-authoring`. Header, row and footer extension contexts track current models. Row content remains inside the official link; preserve the official controls and navigation lifecycle. See [the source contract](THEME_RUNTIME_CONTRACT.md) and [complete wrappers](examples/authoring).

Core is framework-neutral. Optional framework compilers, fonts and image rendering never enter the Core/Plain dependency graph. Metadata is an injected build provider from `@dirwell/share-image`, independent of the renderer.
