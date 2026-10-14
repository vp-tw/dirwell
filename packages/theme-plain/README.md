# @dirwell/theme-plain

Native HTML, links and pagination with no browser JavaScript or runtime dependencies.

Requires Node.js 22.12 or newer. Install the currently published prerelease:

```sh
npm install @dirwell/core@alpha @dirwell/theme-plain@alpha
```

Create `files/note.txt`, save this as `build.mjs`, then run `node build.mjs`:

```js
import { generateExplorer } from "@dirwell/core";
import { createPlainTheme } from "@dirwell/theme-plain";
await generateExplorer({
  sourceDir: "./files",
  outputDir: "./generated",
  theme: createPlainTheme(),
});
```

Serve the complete `generated` folder over HTTP and open its root. Native links/pagination remain usable without JavaScript.

Upcoming stable adds shared `language`, `direction`, `locale`, `timeZone`, partial `labels`, `brand`, `columns` and `cssVariables`. Plain supports opt-in `download` actions while staying script-free. These additions are not in the published alpha. See [theme configuration](https://vp-tw.github.io/dirwell/themes/) and [the public annotation example](https://github.com/vp-tw/dirwell/tree/main/examples/release-downloads). Official themes do not embed media previews.

## Implementation and advanced use

A native HTML renderer with no runtime npm dependencies, browser JavaScript, icons, fonts or default OG images.

`createPlainTheme` returns a structurally compatible core theme. It handles independently generated static pages with native Previous/Next anchors and directory-wide counts. A page remains usable without JavaScript over HTTP and file URLs. Project attribution is optional; metadata appears only when the caller supplies a provider through core.

Install with `npm install @dirwell/core@alpha @dirwell/theme-plain@alpha` for API use. CLI `0.0.1-alpha.1` includes Plain as its minimal default.

Standalone Plain uses explicit generated index filenames for portable no-JavaScript directory links, including breadcrumbs and parent navigation. Set `portableLinks: false` to prefer native directory URLs.
