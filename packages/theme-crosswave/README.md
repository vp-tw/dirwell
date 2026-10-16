# @dirwell/theme-crosswave

Vue categories, directory search and keyboard navigation with optional VueUse gamepad controls.

Requires Node.js 22.12 or newer. Install the packages used by your project:

```sh
npm install --save-exact @dirwell/core @dirwell/theme-crosswave
```

Create `files/note.txt`, save this as `build.mjs`, then run `node build.mjs`:

```js
import { generateExplorer } from "@dirwell/core";
import { createCrosswaveTheme } from "@dirwell/theme-crosswave";
await generateExplorer({
  sourceDir: "./files",
  outputDir: "./generated",
  theme: createCrosswaveTheme({ title: "Sample media files" }),
});
```

Serve the complete `generated` folder over HTTP and open its root. Native links/pagination remain usable without JavaScript.

Configure shared `language`, `direction`, `locale`, `timeZone`, partial `labels`, `brand`, `columns` and `cssVariables`. Opt-in `copy-link`, `copy-path` and `download` actions live outside the primary row link; source wrappers have a separate `actions` region. See [theme configuration](https://vp-tw.github.io/dirwell/themes/) and [the public annotation example](https://github.com/vp-tw/dirwell/tree/main/examples/release-downloads). Official themes do not embed media previews.

The default favicon uses the bundled 16/32/48px paper-bird PNGs from the Dirwell website. To publish your own image, configure `brand.favicon`:

```js
createCrosswaveTheme({
  brand: { favicon: { source: new URL("./favicon.png", import.meta.url) } },
});
```

`source` accepts a `File`, local path or `file:` URL. Path strings resolve from cwd when the theme is created; file URLs resolve independently of cwd. Bytes are read on the first render and cached per instance. Use `{ href: "/brand/favicon.png" }` for an image you already serve, an array for multiple icons with `type`/`sizes`/`media`, or `false` to omit icon declarations and copied assets. Custom icons replace every default icon. `brand.faviconUrl` remains a public-URL/false shorthand; do not combine it with `brand.favicon`. See [favicon configuration](https://vp-tw.github.io/dirwell/themes/#favicons) for formats, deployment bases and browser limits.

## Implementation and advanced use

Vue owns the server markup, reactive category/search/selection state, keyed media rows, folder navigation, appearance and teardown. VueUse `useGamepad` supplies gamepad polling; the theme scopes keyboard listeners, graphics, polling and clocks to the component lifecycle.

Use `createCrosswaveTheme({ title: "Sample media files" })` with `@dirwell/core` and an explicit listing policy. Paged HTML preserves native links without JavaScript. Complete compact listing data is validated before category filtering and search become available. MIME classification runs in Node and publishes small category IDs; no MIME database is sent to the browser.

Options include custom categories, color, gamepad controls and background motion. Controller polling uses VueUse `useGamepad`; automated regression uses simulated standard input. File URLs use native links and pagination.

Vue, VueUse and the browser graphics code belong to this theme only. No Open Graph image implementation is bundled.

## Component source

Import the official component from this package's `/source` entry and model/row
types from `/model`. Use `@dirwell/theme-authoring` to compile the same wrapper
for SSR and client, or its `/dev` entry for trusted local HMR. Header, row content
and footer are customizable; official navigation and interaction ownership is
retained. See [the authoring guide](https://vp-tw.github.io/dirwell/themes/#source-component-customization).

The theme renders more than 500 visible rows through a measured window inside a bounded desktop/mobile scroll region. Full directory data still loads before filtering; this is not query loading. Directory query/category controls are shareable, and Back/Forward restores local selection/scroll. See [view behavior](https://vp-tw.github.io/dirwell/themes/#returning-to-a-view-upcoming-stable).

The 0.0.x API may evolve. Pin your qualified version and upgrade the official family together. See [support and verification](https://vp-tw.github.io/dirwell/support/) for host, browser and device boundaries.

Enable Server `search: {}` to offer live archive search. `archiveSearch: false` hides this dialog without changing directory filtering or categories. Search uses native result links, keyboard Escape/focus restoration, cancellation and retry. Static Crosswave remains directory-oriented and does not build an archive index. See the Server package for fresh-query budgets and permissions.

## Directory URLs

Core uses `routing: { directoryUrls: "explicit" }` by default
for every theme. Choose `slash` for directory-index hosts or `clean` for a
qualified extensionless host. Themes do not rewrite links. Existing source
homepages and download names are preserved; output conflicts fail. CLI config
puts routing at the top level, and `--directory-urls` overrides it.
See [directory URL guidance](https://vp-tw.github.io/dirwell/urls/) for output
placement, host requirements, native Plain file navigation and migration.
