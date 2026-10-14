# @dirwell/theme-crosswave

Vue categories, directory search and keyboard navigation with optional experimental gamepad controls.

Requires Node.js 22.12 or newer. Install the currently published prerelease:

```sh
npm install @dirwell/core@alpha @dirwell/theme-crosswave@alpha
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

Upcoming stable adds shared `language`, `direction`, `locale`, `timeZone`, partial `labels`, `brand`, `columns` and `cssVariables`. Opt-in `copy-link`, `copy-path` and `download` actions live outside the primary row link; source wrappers have a separate `actions` region. These additions are not in the published alpha. See [theme configuration](https://vp-tw.github.io/dirwell/themes/) and [the public annotation example](https://github.com/vp-tw/dirwell/tree/main/examples/release-downloads). Official themes do not embed media previews.

## Implementation and advanced use

Vue owns the server markup, reactive category/search/selection state, keyed media rows, folder navigation, appearance and teardown. VueUse `useGamepad` supplies gamepad polling; the theme scopes keyboard listeners, graphics, polling and clocks to the component lifecycle.

Use `createCrosswaveTheme({ title: "Sample media files" })` with `@dirwell/core` and an explicit listing policy. Paged HTML preserves native links without JavaScript. Complete compact listing data is validated before category filtering and search become available. MIME classification runs in Node and publishes small category IDs; no MIME database is sent to the browser.

Options include custom categories, color, gamepad controls and background motion. Physical gamepads remain unverified. File URLs use native links and pagination.

Vue, VueUse and the browser graphics code belong to this theme only. No Open Graph image implementation is bundled.

## Component source

Import the official component from this package's `/source` entry and model/row
types from `/model`. Use `@dirwell/theme-authoring` to compile the same wrapper
for SSR and client, or its `/dev` entry for trusted local HMR. Header, row content
and footer are customizable; official navigation and interaction ownership is
retained. See [the authoring guide](https://vp-tw.github.io/dirwell/themes/#source-component-customization).
