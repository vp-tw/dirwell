# Theme package contract

An independent package returns `ExplorerTheme` from `@dirwell/core`. Consumers pass it to `generateExplorer`, server handlers or `dirwell.config.mjs`. It owns its complete HTML, CSS, assets, options and browser behavior.

`render(context)` is sync or async and returns `{ html, assets? }`. Use `hrefFor`, `hrefForDirectory`, `assetHref` and `exitsExplorerFor` rather than reconstructing URLs. Render unavailable text when a link is null, preserve `documentBaseHref`, and include optional `metadata.head` deliberately.

Private Node-side `DirectoryData` contains source paths and raw metadata. Never serialize those into browser data. Use public `ListingEntry` projections; escape names, target text and other untrusted strings. Optional entry data must be JSON-compatible. Themes execute trusted Node code and own their asset licensing.

Opt into `listing.pagination` only when native page links are rendered. HTML pagination is independent of client DOM windowing. Set `searchIndex: false` when archive search is absent. Styles and language controls belong to the theme.

Assets use validated filenames. MPA shared filenames must have identical bytes across pages; collisions fail. Refer to assets using context links. Optional share metadata/images are injected through `@dirwell/share-image`, not implicitly bundled in a theme.

Declare and test the supported Core version in peer dependencies. Verify imports/types, SSG/MPA, encoded names, child navigation, asset loading and unavailable symlinks in an installed consumer. Official Svelte/Vue source customization instead uses the [paired source compiler](THEME_RUNTIME_CONTRACT.md).

## Next routing context contract

Core owns directory URL policy. Render `hrefFor` and nullable `hrefForDirectory`
results directly; render missing targets as text. Do not append `index.html` or
infer logical paths from URL shape. `directoryPathForEntry(entryId)` returns the
permitted generated directory identity, and `assetHrefForDirectory(path, name)`
resolves theme-owned data/assets from the current public document base. Live
`pageDataHref` remains a separate endpoint contract. Native anchors, public
records, client History, pagination and metadata must identify the same target.
The removed Plain `portableLinks` maps to shared explicit/slash routing. See
[the URL guide](docs/src/content/docs/urls.md). This changes the next SDK contract;
it does not describe the capabilities of already-published historical releases.
