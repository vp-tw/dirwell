# Independent theme package

This private example exports a factory returning `ExplorerTheme` from `@dirwell/core`. It owns HTML/CSS and escapes names, uses context navigation helpers and preserves optional metadata. It does not install an image renderer or a rich theme.

Publish your own package with a tested Core peer range, then import its factory into `dirwell.config.mjs` or pass it to `generateExplorer` / server handlers. Include your assets and public declarations in the package payload. Test packed installation, SSG/MPA and child navigation before widening a peer range. See [the theme package contract](../../THEME_PACKAGE_CONTRACT.md).
