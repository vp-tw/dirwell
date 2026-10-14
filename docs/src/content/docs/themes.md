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

## Choose a theme by task

| Need                                           | Plain                     | Ledger                           | Crosswave                                     |
| ---------------------------------------------- | ------------------------- | -------------------------------- | --------------------------------------------- |
| Native links and pagination without JavaScript | Yes                       | Yes                              | Yes                                           |
| Current-directory search                       | No                        | Yes                              | Yes                                           |
| Archive-wide search                            | No                        | Static only; opt out available   | No                                            |
| Sorting                                        | Configured in Core/server | Interactive and configured       | Configured in Core/server                     |
| Categories and controller input                | No                        | No                               | Configurable categories; VueUse gamepad input |
| Common labels, branding and columns            | Yes                       | Yes                              | Yes                                           |
| Independent actions                            | Native download           | Copy/download and source actions | Copy/download and source actions              |
| Embedded image/audio/video preview             | No                        | No                               | No                                            |
| Large-list rendering                           | Native page size          | Measured DOM windows             | Measured DOM windows                          |

Rich themes load complete directory data. Native pagination, data blocks and rendered windows solve different costs; consult the [packed SDK benchmark](https://github.com/vp-tw/dirwell/blob/main/BENCHMARKS.md). File opening/download URLs are supplied by static publication or the Node server; this is separate from embedding a media preview in a theme. A custom source theme can implement its own interface. [Support and verification](../support/) records tested host/device boundaries.

```js
import { createLedgerTheme } from "@dirwell/theme-ledger";
export default { theme: createLedgerTheme({ title: "Downloads" }) };
```

Save as `dirwell.config.mjs` after installing CLI and Ledger. Rich themes load complete coherent listing data before enabling directory-wide filters. Native HTML pagination remains usable without JavaScript; it is independent of interactive row virtualization.

<span id="shared-configuration-upcoming-stable"></span>

## Shared configuration

All three official factories accept the same small, serializable customization surface:

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

Install `@dirwell/theme-authoring` for trusted source customization. Wrap Ledger from `@dirwell/theme-ledger/source` in Svelte, or Crosswave from `@dirwell/theme-crosswave/source` in Vue. Both expose header, row, actions and footer extension contexts. Row content lives inside the official link; do not nest interactive controls. Put independent buttons or links in the `actions` snippet/slot instead; it receives the same public row context.

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

<span id="returning-to-a-view-upcoming-stable"></span>

## Returning to a view

Enhanced Ledger and Crosswave keep directory controls in the current URL without adding a history entry for each keystroke:

- `dw.q`: directory query, up to 4,096 characters.
- Ledger `dw.sort`: `field:direction:nameMode:folders` (or `mixed`), for example `size:desc:unicode:mixed`; `dw.types`: comma-separated `directory,file,link`, or an empty value to hide all types.
- Crosswave `dw.category`: a configured category ID, such as `document` in the default set.

A fresh tab or refresh applies those controls after hydration. Unsupported values fall back to theme defaults. Host query parameters and native `page` parameters remain intact. Plain and no-JavaScript pages retain their native listing order/pagination and ignore enhancement controls. Archive-dialog queries and appearance preferences are separate.

Entering a new folder starts its default controls. Back/Forward restores that history entry's controls, selected logical ID and scroll; deleted or filtered selections are cleared. Crosswave retains measured heights for up to eight directories at the same layout width and discards that cache on resize. This is local history state, not a shareable selection or a filesystem snapshot.

A failed enhanced folder request keeps the successful view and offers Retry plus the target's native link. Retry uses the failed target. Superseded requests cannot replace a newer view. If the host denies a History mutation, the view stays usable through native links. Skipped source pages retain native parent/Home navigation.

Large Crosswave directories now use measured DOM windows above 500 visible rows, with a bounded scroll region that reserves the actual footer height on desktop and mobile. Ledger also windows large lists. Both still load complete directory data; blocks and DOM windows do not turn this into query loading or bound total data memory. See [the SDK benchmark](https://github.com/vp-tw/dirwell/blob/main/BENCHMARKS.md) for workload-specific evidence.

## Document assets and CSP

Common identity, logo, footer and font/color variables use the shared configuration above. For application styles/head elements without source compilation, wrap the typed `render(context)` result, retain its assets/client/data protocol and add assets through `RenderedPage.assets` plus `context.assetHref`. See the [document branding helper](https://github.com/vp-tw/dirwell/tree/main/examples/private-downloads). Asset names must not collide with selected source files; use source snippets/slots for body layout changes.

The private live recipe composes fresh response nonces with a nonce/`strict-dynamic` script policy and nonced stylesheet elements. Inline style attributes remain explicitly allowed for measured row positioning; inline scripts, event handlers and eval remain blocked. Host sessions, CSP delivery and external brand-resource permissions belong to the application. This is an executed production-renderer recipe, not a development-Vite policy or an HTML sanitizer. [W3C CSP3](https://www.w3.org/TR/CSP3/#strict-dynamic-usage) defines the policy model.
