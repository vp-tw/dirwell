---
title: Themes and source customization
description: Choose Plain, Ledger or Crosswave, or own the renderer.
---

CLI includes Plain. Core and integrations require a theme explicitly. Install only what your project uses.

| Theme     | Package                    | Behavior                                                                 |
| --------- | -------------------------- | ------------------------------------------------------------------------ |
| Plain     | `@dirwell/theme-plain`     | Native HTML, links and pagination; no JavaScript/assets by default       |
| Ledger    | `@dirwell/theme-ledger`    | Svelte search, sorting, keyboard selection and large-list virtualization |
| Crosswave | `@dirwell/theme-crosswave` | Vue crossbar, categories, keyboard and gamepad navigation                |

```js
import { createLedgerTheme } from "@dirwell/theme-ledger";
export default { theme: createLedgerTheme({ title: "Downloads" }) };
```

Save as `dirwell.config.mjs` after installing CLI and Ledger. Rich themes load complete coherent listing data before enabling directory-wide filters. Native HTML pagination remains usable without JavaScript; it is independent of interactive row virtualization.

## Shared configuration (upcoming stable)

These options are implemented for the next release; the published alpha does not yet include them. All three official factories accept the same small, serializable customization surface:

```js
createLedgerTheme({
  language: "en",
  direction: "ltr",
  locale: "en-US",
  timeZone: "UTC",
  labels: { archive: "Release archive", download: "Get file" },
  brand: {
    name: "Sample downloads",
    logoUrl: "/brand/logo.png",
    logoAlt: "Sample project",
    faviconUrl: "/brand/favicon.png",
    footerText: "Project documentation",
    footerUrl: "https://example.com/docs",
  },
  columns: ["name", { dataKey: "description", label: "Description" }, "size"],
  actions: ["copy-link", "copy-path", "download"],
  cssVariables: { "--dw-font-family": "system-ui", "--accent": "#174ea6" },
  archiveSearch: false,
});
```

Partial `labels` retain English defaults. `ThemeLabels` from each theme package lists every key, including accessible names, errors, dialogs and pagination. Keep placeholders such as `{count}`, `{path}`, `{page}` and `{pages}` in translated strings. Document language does not translate labels automatically. Supply `locale` **and** `timeZone` for identical server/browser date formatting. Without either, server dates use UTC and hydrated dates use the viewer's local setting. Locale affects dates; listing name collation remains controlled by the listing sort contract.

Brand assets must use HTTP(S) or root-relative URLs. Dirwell does not copy external brand assets: publish them at the specified URLs. Footer text is escaped. No footer, logo or font download is added by default. `--dw-font-family` accepts an installed font stack; loading font files belongs to the host. Ledger exposes `--paper`, `--surface`, `--ink`, `--muted`, `--rule`, `--accent` and `--focus`; Crosswave exposes `--cw-top`, `--cw-bottom`, `--cw-text`, `--cw-muted` and `--cw-focus`. Set a coherent palette for contrast. Other internal CSS variables and selectors are not compatibility promises.

Columns retain the configured order and must include `name`. Custom columns display explicitly supplied public JSON fields; strings are escaped, objects/arrays display as JSON. Ledger uses columns across a row; Crosswave stacks these fields in its entry card. For richer formatting, use a source row wrapper or an independent renderer.

Actions are opt-in and separate from the primary navigation link. `copy-link` copies the resolved public URL; `copy-path` copies the logical path relative to the explorer root. Clipboard requires browser permission/support and reports failure. Plain supports only `download`, preserving its script-free contract. An HTML download hint does not override a cross-origin host's headers. Official themes do not include media previews.

Ledger's `archiveSearch: false` hides its archive control and omits the generated index. Directory filtering remains available. Static archive search covers names/paths, not file contents or public annotations; live mode offers directory search only. Loaded archive data is reused for up to 60 seconds, with a 100,000-entry safety limit and at most 100 displayed results. Retry is available after loading failure.

See the [release annotation example](https://github.com/vp-tw/dirwell/tree/main/examples/release-downloads) for build and live use without a theme fork.

## Crosswave options

```js
import { createCrosswaveTheme, defaultCrosswaveCategories } from "@dirwell/theme-crosswave";

export default {
  theme: createCrosswaveTheme({
    title: "Media library",
    color: "jade",
    gamepad: true,
    backgroundMotion: true,
    categories: defaultCrosswaveCategories,
  }),
};
```

Categories have unique ids, labels, icons and extension/MIME match rules. MIME inference happens on Node, not through a browser database. Inspect the [category example](https://github.com/vp-tw/dirwell/tree/main/examples/crosswave-categories) for ordering, custom SVG and overlapping rules.

Plain accepts `project` attribution options and `portableLinks`; its normal minimal mode emits no footer/image/font assets. Page metadata belongs in the optional [metadata provider](../metadata/), independently of theme selection.

## Source component customization

Install `@dirwell/theme-authoring@alpha` for trusted source customization. Wrap Ledger from `@dirwell/theme-ledger/source` in Svelte, or Crosswave from `@dirwell/theme-crosswave/source` in Vue. Both expose header, row, actions and footer extension contexts. Row content lives inside the official link; do not nest interactive controls. Put independent buttons or links in the `actions` snippet/slot instead; it receives the same public row context.

```js
import { buildFrameworkTheme } from "@dirwell/theme-authoring";
const result = await buildFrameworkTheme({
  framework: "svelte",
  component: "./Ledger.svelte",
  output: "./generated-theme",
});
const { createTheme } = await import(result.themeUrl);
export default { theme: createTheme({ title: "Downloads" }) };
```

Compile matching SSR/client output before using it in a build or server. Rebuilds require a fresh import and renderer instance. `@dirwell/theme-authoring/dev` supplies loopback-only native HMR; CSS-only edits preserve state, while wrapper/script edits can remount children. It is separate from production file-data SSE. See [complete source wrappers](https://github.com/vp-tw/dirwell/tree/main/examples/authoring).

## Independent themes

Implement `ExplorerTheme` from `@dirwell/core`: `name` and `render(context)` returning a complete HTML document plus optional assets. Escape filenames and other untrusted text. Do not serialize absolute source paths, inode/ownership data or raw stat objects. Use public listing records for client data. Opt into pagination only if the renderer emits native page links. See [API reference](../api-reference/).
