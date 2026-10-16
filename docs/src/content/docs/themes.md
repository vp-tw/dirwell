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
| Archive-wide search                            | No                        | Static and opt-in live queries   | Opt-in live queries                           |
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

All three official factories accept shared presentation options. Local favicon inputs stay on Node; browser models contain only public presentation data:

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
    favicon: { source: new URL("./brand/favicon.png", import.meta.url) },
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

The logo and footer link accept HTTP(S) or root-relative URLs that you serve. Favicons also accept local images that Dirwell publishes, as described below. Footer text is escaped. No footer, logo or font download is added by default. `--dw-font-family` accepts an installed font stack; loading font files belongs to the host. Ledger exposes `--paper`, `--surface`, `--ink`, `--muted`, `--rule`, `--accent` and `--focus`; Crosswave exposes `--cw-top`, `--cw-bottom`, `--cw-text`, `--cw-muted` and `--cw-focus`. Set a coherent palette for contrast. Other internal CSS variables and selectors are not compatibility promises.

Columns retain the configured order and must include `name`. Custom columns display explicitly supplied public JSON fields; strings are escaped, objects/arrays display as JSON. Ledger uses columns across a row; Crosswave stacks these fields in its entry card. For richer formatting, use a source row wrapper or an independent renderer.

Actions are opt-in and separate from the primary navigation link. `copy-link` copies the resolved public URL; `copy-path` copies the logical path relative to the explorer root. Clipboard requires browser permission/support and reports failure. Plain supports only `download`, preserving its script-free contract. An HTML download hint does not override a cross-origin host's headers. Official themes do not include media previews.

Ledger's `archiveSearch: false` hides its archive control and omits the generated index. Directory filtering remains available. Static archive search covers names/paths, not file contents or public annotations; live archive queries are available when Server `search` is enabled. Loaded archive data is reused for up to 60 seconds, with a 100,000-entry safety limit and at most 100 displayed results. Retry is available after loading failure. Crosswave exposes a live archive dialog with the same Server query capability; `archiveSearch: false` hides it. Both retain current-directory filtering. Live queries scan fresh names/paths under server budgets and refresh open visible dialogs every two seconds by default; they do not download a static archive index. See [live query configuration](../configuration/#live-archive-search).

See the [release annotation example](https://github.com/vp-tw/dirwell/tree/main/examples/release-downloads) for build and live use without a theme fork.

### Favicons

Ledger and Crosswave include the Dirwell website's 16, 32 and 48px paper-bird PNGs
by default. Plain has no default favicon. Use `brand.favicon` in any official theme
to publish your own image, reference an existing public image, or disable icon links.
You do not need `@dirwell/share-image` for favicons.

#### Publish a local image

Put your image beside `dirwell.config.mjs`, then configure its source:

```js
import { createLedgerTheme } from "@dirwell/theme-ledger";

export default {
  theme: createLedgerTheme({
    brand: {
      favicon: { source: new URL("./favicon.png", import.meta.url) },
    },
  }),
};
```

Dirwell copies the original bytes into theme assets and creates the appropriate
icon link for the current folder, deployment base and output layout. A `file:` URL
is useful in configuration modules because it resolves from the module's location.
The image can live outside the archive's `sourceDir`.

`source` also accepts a local path string or a Node `File`:

```js
const fromPath = createLedgerTheme({
  brand: { favicon: { source: "./brand/favicon.png" } },
});

const fromFile = createLedgerTheme({
  brand: {
    favicon: {
      source: new File(
        [
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#174ea6"/></svg>',
        ],
        "favicon.svg",
        { type: "image/svg+xml" },
      ),
    },
  },
});
```

Relative path strings resolve from the process working directory **when the theme
is created**, not from the configuration file or archive root. Absolute paths are
also supported. Options are snapshotted at creation; local bytes are read on the
first render and cached for that theme instance. Create a new instance after
changing the image. Missing or unreadable files fail the build without replacing
the previous successful output. Source paths and `File` objects are not serialized
into page data.

#### Reference an image you already serve

Use `href` for an HTTP(S) or root-relative URL. Dirwell emits the URL without
fetching or copying the image:

```js
createLedgerTheme({
  brand: { favicon: { href: "/downloads/brand/favicon.png" } },
});
```

A root-relative URL starts at the effective base URL's host root; include any
required deployment prefix yourself. An absolute HTML `<base>` can also change
that host. A fully qualified `https://…` URL fixes both the host and path.
A descriptor must have exactly one of `source` and `href`.

#### Supply multiple sizes or light/dark icons

An array replaces all default icons. Each entry may specify `type`, `sizes` and
`media`; the browser chooses an applicable image:

```js
createLedgerTheme({
  brand: {
    favicon: [
      {
        source: new URL("./brand/light.svg", import.meta.url),
        media: "(prefers-color-scheme: light)",
      },
      {
        source: new URL("./brand/dark.svg", import.meta.url),
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
});
```

Supported source formats are PNG, SVG, ICO, JPEG, GIF, WebP and AVIF. MIME type
comes from explicit `type`, then a nonempty `File.type`, then the filename extension.
An unknown type requires a supported explicit image MIME type. SVG sources default
to `sizes: "any"`; other sources omit `sizes` unless supplied. Use `"32x32"` or
space-separated dimensions such as `"16x16 32x32"` for raster sizes. These attributes
describe your image; Dirwell does not inspect dimensions, resize, convert or sanitize
image bytes. Use images you trust. Browser format and icon-selection support varies.

#### Disable icons and understand publication

```js
createLedgerTheme({ brand: { favicon: false } });
```

`false` omits icon declarations and copied favicon assets. It does not guarantee
an empty browser tab icon: browsers may request the host's `/favicon.ico` under the
[HTML icon standard](https://html.spec.whatwg.org/multipage/links.html#rel-icon).
An archive file named `favicon.ico` remains an ordinary file; it is not automatically
selected or replaced. Home-screen icons and PWA manifests require separate setup.

The existing `brand.faviconUrl` shorthand accepts an HTTP(S)/root-relative URL or
`false`. It has the same replacement behavior. Configure only one of `favicon` and
`faviconUrl`; supplying both is an error.

SSG publishes copied icons beside each folder; MPA shares them under `__dirwell`.
The live server serves them through its mounted theme-asset route with the matching
MIME type. Identical image bytes and output formats share a content-based filename.
Ledger and Crosswave keep icon links current during folder navigation and History
restoration. Enhanced navigation requires same-origin page snapshots; when a
cross-origin deployment base prevents loading a snapshot, the current view stays
visible and offers retry or the native folder link. Serve the complete output at
the configured base so that native navigation can reach it.

Favicons belong to each theme's document. Core supplies asset publication and URL
resolution, while the optional metadata provider supplies social previews.
Independent themes retain control over their own icon policy.

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

Plain accepts `project` attribution options. URL policy belongs to Core `routing`, not themes; `portableLinks` is removed. See [directory URLs](../urls/#migrate-theme-code). Its normal minimal mode emits no footer/image/font assets. Page metadata belongs in the optional [metadata provider](../metadata/), independently of theme selection.

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

## File size display

Plain, Ledger and Crosswave use the same size defaults: binary units, up to three
significant digits for converted values, and both target and link sizes for symlinks.
Sizes are plain text by default, without expand controls. Plain remains script-free.

All three factories accept:

```ts
const size = {
  units: "decimal", // "binary" (default), "decimal", or "bytes"
  symlink: "both", // "both" (default), "target", or "entry"
  exact: "none", // "none" (default), "details", or "inline"
  maximumFractionDigits: 2, // optional; overrides automatic precision
} as const;
createPlainTheme({ size });
createLedgerTheme({ size });
createCrosswaveTheme({ size });
```

Numbers use the theme's `locale` (default `en-US`); `size.locale` can override it.
Known zero is `0 B`. Folders have no calculated content size. A symlink's target
is labeled separately from its own link size; an unavailable or withheld target
never silently uses the link size. Raw bytes remain available for numeric sorting
and custom themes. Publishers can opt into exact bytes with `exact: "details"`
or `exact: "inline"`; these only add values that differ from the visible text.
Opt-in details work with keyboard and touch, without relying on hover.

Display settings do not change sorting. `sort.field: "size"` means item size;
`sort.field: "targetSize"` means file-target size. Ledger exposes both choices
and supports `targetSize` in `dw.sort` URLs. Non-comparable sizes follow numeric
sizes in either direction, subject to folders-first.

### Independent themes

Raw `ListingEntry.size` and `link.targetSize` remain available. Custom themes
can use the optional, browser-safe public helper without importing an official
theme or adopting its markup:

```ts
import { formatBytes, sizeValue } from "@dirwell/core/format";

const bytes = sizeValue(entry);
const text = bytes === null ? "Unavailable" : formatBytes(bytes);
// Or render entry.size directly using your own rules.
```

The formatter supports binary, decimal and exact bytes with an explicit locale.
It accepts known non-negative safe integers, not nullable state. Directory totals,
disk allocation and compressed transfer sizes are separate capabilities and are
not calculated by these helpers.

## Plain new-tab hints

Plain keeps file links opening in a new tab and directory navigation in the
current tab. The new-tab hint is a localized accessible description attached to
the affected links; it does not repeat as visible metadata in each row. Native
download actions and Core routing remain unchanged.
