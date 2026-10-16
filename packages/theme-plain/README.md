# @dirwell/theme-plain

Native HTML, links and pagination with no browser JavaScript or runtime dependencies.

Requires Node.js 22.12 or newer. Install the first stable family:

```sh
npm install @dirwell/core@0.0.3 @dirwell/theme-plain@0.0.3
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

Serve the complete `generated` folder over HTTP and open its root. Native links/pagination remain usable without JavaScript. File links keep opening in a new tab; the hint is an accessible description instead of repeated visible row text.

Version `0.0.1` adds shared `language`, `direction`, `locale`, `timeZone`, partial `labels`, `brand`, `columns` and `cssVariables`. Plain supports opt-in `download` actions while staying script-free. See [theme configuration](https://vp-tw.github.io/dirwell/themes/) and [the public annotation example](https://github.com/vp-tw/dirwell/tree/main/examples/release-downloads). Official themes do not embed media previews.

## Implementation and advanced use

A native HTML renderer with no runtime npm dependencies, browser JavaScript, icons, fonts or default OG images.

`createPlainTheme` returns a structurally compatible core theme. It handles independently generated static pages with native Previous/Next anchors and directory-wide counts. A page remains usable without JavaScript over HTTP and file URLs. Project attribution is optional; metadata appears only when the caller supplies a provider through core.

Install with `npm install @dirwell/core@0.0.3 @dirwell/theme-plain@0.0.3` for API use. CLI `0.0.1` includes Plain as its minimal default.

Core now supplies explicit filenames by default for native no-JavaScript links. The Plain `portableLinks` option is removed; select Core `routing.directoryUrls` instead.

The 0.0.x API may evolve. Pin your qualified version and upgrade the official family together. See [support and verification](https://vp-tw.github.io/dirwell/support/) for host, browser and device boundaries.

## Directory URLs

Version 0.0.3 uses Core `routing: { directoryUrls: "explicit" }` by default
for every theme. Choose `slash` for directory-index hosts or `clean` for a
qualified extensionless host. Themes do not rewrite links. Existing source
homepages and download names are preserved; output conflicts fail. CLI config
puts routing at the top level, and `--directory-urls` overrides it.
See [directory URL guidance](https://vp-tw.github.io/dirwell/urls/) for output
placement, host requirements, native Plain file navigation and migration.
