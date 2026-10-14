# @dirwell/theme-ledger

Searchable Svelte directory listings with sorting, keyboard selection and row virtualization.

Requires Node.js 22.12 or newer. Install the first stable family:

```sh
npm install @dirwell/core@0.0.1 @dirwell/theme-ledger@0.0.1
```

Create `files/note.txt`, save this as `build.mjs`, then run `node build.mjs`:

```js
import { generateExplorer } from "@dirwell/core";
import { createLedgerTheme } from "@dirwell/theme-ledger";
await generateExplorer({
  sourceDir: "./files",
  outputDir: "./generated",
  theme: createLedgerTheme({ title: "Sample downloads" }),
});
```

Serve the complete `generated` folder over HTTP and open its root. Native links/pagination remain usable without JavaScript.

Version `0.0.1` adds shared `language`, `direction`, `locale`, `timeZone`, partial `labels`, `brand`, `columns` and `cssVariables`. Opt-in `copy-link`, `copy-path` and `download` actions live outside the primary row link; source wrappers have a separate `actions` region. See [theme configuration](https://vp-tw.github.io/dirwell/themes/) and [the public annotation example](https://github.com/vp-tw/dirwell/tree/main/examples/release-downloads). Official themes do not embed media previews.

## Implementation and advanced use

Svelte owns the server markup, client state, keyed rows, search, sorting, dialogs, navigation and cleanup. No framework-neutral serialized UI tree or imperative theme controller is used.

Use `createLedgerTheme({ title: "Sample downloads" })` with `@dirwell/core` and an explicit listing policy. Paged HTML preserves native links without JavaScript. The browser loads and validates the complete compact listing before enabling directory-wide search and sorting; directories exceeding 500 visible rows use measured row virtualization. Folder snapshots resolve navigation URLs before updating History.

The theme includes directory type filtering, fuzzy search, name/size/modified sorting, natural/locale/Unicode names, color schemes, timestamp details, archive search, and keyboard selection. File URLs use native navigation and pagination.

The package contains a separately compiled classic browser script and Node server renderer. Svelte is a dependency of this theme, not core or Plain. No Open Graph image implementation is bundled.

## Component source

Import the official component from this package's `/source` entry and model/row
types from `/model`. Use `@dirwell/theme-authoring` to compile the same wrapper
for SSR and client, or its `/dev` entry for trusted local HMR. Header, row content
and footer are customizable; official navigation and interaction ownership is
retained. See [the authoring guide](https://vp-tw.github.io/dirwell/themes/#source-component-customization).

Stable shares directory query/sort/type controls through URL parameters and restores per-entry History selection/scroll. Failed navigation retains the previous view and offers retry/native navigation. See [view behavior](https://vp-tw.github.io/dirwell/themes/#returning-to-a-view-upcoming-stable).

The 0.0.x API may evolve. Pin your qualified version and upgrade the official family together. See [support and verification](https://vp-tw.github.io/dirwell/support/) for host, browser and device boundaries.
