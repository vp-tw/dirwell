# @dirwell/theme-plain

Native HTML, links and pagination with no browser JavaScript or runtime dependencies.

Requires Node.js 22.12 or newer. Install the packages used by your project:

```sh
npm install --save-exact @dirwell/core @dirwell/theme-plain
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

Configure shared `language`, `direction`, `locale`, `timeZone`, partial `labels`, `brand`, `columns` and `cssVariables`. Plain supports opt-in `download` actions while staying script-free. See [theme configuration](https://vp-tw.github.io/dirwell/themes/) and [the public annotation example](https://github.com/vp-tw/dirwell/tree/main/examples/release-downloads). Official themes do not embed media previews.

Plain has no default favicon. To publish your own image, configure `brand.favicon`:

```js
createPlainTheme({
  brand: { favicon: { source: new URL("./favicon.png", import.meta.url) } },
});
```

`source` accepts a `File`, local path or `file:` URL. Path strings resolve from cwd when the theme is created; file URLs resolve independently of cwd. Bytes are read on the first render and cached per instance. Use `{ href: "/brand/favicon.png" }` for an image you already serve, an array for multiple icons with `type`/`sizes`/`media`, or `false` to omit icon declarations and copied assets. Custom icons replace every default icon. `brand.faviconUrl` remains a public-URL/false shorthand; do not combine it with `brand.favicon`. See [favicon configuration](https://vp-tw.github.io/dirwell/themes/#favicons) for formats, deployment bases and browser limits.

## Implementation and advanced use

A native HTML renderer with no runtime npm dependencies or browser JavaScript. Its default output has no icon, font or social-image assets.

`createPlainTheme` returns a structurally compatible core theme. It handles independently generated static pages with native Previous/Next anchors and directory-wide counts. A page remains usable without JavaScript over HTTP and file URLs. Project attribution is optional; metadata appears only when the caller supplies a provider through core.

CLI includes Plain as its minimal default.

Core now supplies explicit filenames by default for native no-JavaScript links. The Plain `portableLinks` option is removed; select Core `routing.directoryUrls` instead.

The 0.0.x API may evolve. Pin your qualified version and upgrade the official family together. See [support and verification](https://vp-tw.github.io/dirwell/support/) for host, browser and device boundaries.

## Directory URLs

Core uses `routing: { directoryUrls: "explicit" }` by default
for every theme. Choose `slash` for directory-index hosts or `clean` for a
qualified extensionless host. Themes do not rewrite links. Existing source
homepages and download names are preserved; output conflicts fail. CLI config
puts routing at the top level, and `--directory-urls` overrides it.
See [directory URL guidance](https://vp-tw.github.io/dirwell/urls/) for output
placement, host requirements, native Plain file navigation and migration.
