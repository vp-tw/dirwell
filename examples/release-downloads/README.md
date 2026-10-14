# Release downloads with public annotations

This example keeps filesystem names, public annotations and theme presentation separate. Use the synchronized `0.0.1` package family.

Requires Node.js 22.12 or newer. In a clean project, install `@dirwell/core` and `@dirwell/theme-ledger`, then copy `build.mjs` and `annotations.json` here. Create `files/release.txt` with sample release notes, run `node build.mjs`, and serve `generated` over HTTP. Every artifact row receives the description/checksum keyed by its logical path; no private absolute paths are supplied to the callback. The sample checksum is a placeholder, not an integrity claim. Keep the sidecar outside the public source folder.

For a live service, read your sidecar into memory and pass the same callback to `createDirectoryService({root: "./files", entryData})`. Replace that in-memory object when the sidecar changes; a subsequent read produces a new revision. Don't reread or hash large artifacts for every listing request. Annotations are public to every reader authorized to list the directory and are display-only; they do not implement row permissions or full-text search.

For files already on a CDN, add `mirror: false` and:

```js
fileHref: (logicalPath) => "https://cdn.example.com/releases/" +
  logicalPath.split("/").map(encodeURIComponent).join("/"),
```

Ensure the CDN paths and headers actually serve those artifacts. Dirwell still publishes a complete dedicated tree of HTML, data and theme assets. The download attribute is a hint; cross-origin transport and attachment headers belong to the CDN.

[Theme configuration](https://vp-tw.github.io/dirwell/themes/) · [API guide](https://vp-tw.github.io/dirwell/api-reference/)
