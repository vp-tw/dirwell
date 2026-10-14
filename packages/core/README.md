# @dirwell/core

Framework-neutral filesystem, listing and static-publication SDK. Requires Node.js 22.12 or newer. For this quick start, install `npm install @dirwell/core@alpha @dirwell/theme-plain@alpha`.

Core owns filesystem selection, safe navigation, public listing projection and static publication. It requires an explicit theme and does not load a default theme, image renderer, frontend framework, config loader or watcher. Runtime matching uses picomatch for globs and ignore for Git-style ignore files.

```js
import { generateExplorer } from "@dirwell/core";
import { createPlainTheme } from "@dirwell/theme-plain";
await generateExplorer({
  sourceDir: "./files",
  outputDir: "./generated",
  theme: createPlainTheme(),
});
console.log("Generated ./generated");
```

Create `files/note.txt`, save the code as `build.mjs` and run `node build.mjs`. Serve the complete generated output over HTTP.

Upcoming stable controls: `ignoreFiles` defaults to `[]`; explicit files must exist unless marked optional. Relative paths resolve from cwd, and patterns resolve from each file's directory unless `baseDir` is set. `outputPolicy: "owned"` protects nonempty unmarked destinations; explicit `"replace"` permits replacement. `dryRun: true` returns the selected paths and page plan without writing output. These controls are not in the published alpha. See the [API guide](https://vp-tw.github.io/dirwell/api-reference/).

`generateExplorer` publishes a dedicated output tree. `listing` independently plans HTML pages and data blocks; a synchronous callback can select plans per directory. Metadata rendering is an injected Node-side provider. `createDirectoryService` performs live, one-directory reads without writing a generated tree. With filters, selection still walks physical names to preserve descendant inclusion; it is not a constant-cost indexed database query.

The service rejects dot segments, absolute paths, backslashes, reserved root paths and paths outside the physical root. Symlink metadata retains existing declared-target behavior. Node-side entries are private inputs; use `projectListingEntry` before public serialization. Reads are not a transactional filesystem snapshot and are not qualified against adversarial concurrent directory replacement.

Upcoming stable also adds validated public `entryData` annotations and static `fileHref` mapping for existing CDN files. See the [API guide](https://vp-tw.github.io/dirwell/api-reference/#public-annotations-and-file-url-mapping-upcoming-stable) for callback timing and public-data boundaries.
