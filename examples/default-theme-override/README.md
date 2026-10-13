# Ledger source customization

`Ledger.svelte` wraps the official Svelte source with header and row snippets, Catppuccin SVG icons and light/dark CSS. The optional authoring compiler produces paired SSR/client bundles; config includes the icon license notice.

From an installed repository checkout:

```sh
node scripts/build-example.ts default-theme-override ./generated-default-theme-override
```

`config.ts` exports core `GenerateOptions`; it is consumed by this SDK build script, not discovered by CLI. For a standalone CLI project, use `dirwell.config.mjs` with `{ theme, build, server, listing }`. Build replaces its dedicated output tree. Serve the complete result over HTTP. `SITE_BASE=/dirwell/ pnpm site:build` publishes every example for the documentation site.
