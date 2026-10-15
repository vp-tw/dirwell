# Official theme source contract

Ledger is a Svelte component and Crosswave is a Vue component. Use `/source` and `/model` exports from their packages and compile a wrapper with `@dirwell/theme-authoring`. See [the authoring guide](packages/theme-authoring/README.md).

Header and footer receive `{ model }`. Row extensions receive `{ model, entry, selected }`. Models update with directory navigation and live revisions. Row content lives inside an official link, so do not nest links/buttons/inputs. The official component owns row identity, selection, filtering, virtualization, pagination, dialogs, history and gamepad lifecycle.

SSR and client output must come from the same compilation. Failed builds retain previous output. After replacing output, import a fresh module and create a fresh theme instance; Node caches already-imported modules. Production file refresh does not recompile theme source.

Source HMR is a loopback-only trusted development service. CSS-only edits preserve state; template/script edits can remount children. File changes use separate SSE revision notifications. Do not expose source HMR publicly.

Verify custom wrappers in SSG and MPA, with and without JavaScript, narrow widths, directory/history navigation, search and appearance modes. Large-list changes also need virtualization coverage. See [the Catppuccin wrapper](examples/default-theme-override/Ledger.svelte) and [public examples](docs/src/content/docs/examples.mdx).

## SDK 0.0.3 routing context contract

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
