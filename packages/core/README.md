# @dirwell/core

Framework-neutral filesystem, listing and static-publication SDK. Requires Node.js 22.12 or newer. For this quick start, install `npm install @dirwell/core@0.0.1 @dirwell/theme-plain@0.0.1`.

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

Stable controls: `ignoreFiles` defaults to `[]`; explicit files must exist unless marked optional. Relative paths resolve from cwd, and patterns resolve from each file's directory unless `baseDir` is set. `outputPolicy: "owned"` protects nonempty unmarked destinations; explicit `"replace"` permits replacement. `dryRun: true` returns the selected paths and page plan without writing output. See the [API guide](https://vp-tw.github.io/dirwell/api-reference/).

`generateExplorer` publishes a dedicated output tree. `listing` independently plans HTML pages and data blocks; a synchronous callback can select plans per directory. Metadata rendering is an injected Node-side provider. `createDirectoryService` performs live, one-directory reads without writing a generated tree. With filters, selection still walks physical names to preserve descendant inclusion; it is not a constant-cost indexed database query.

The service rejects dot segments, absolute paths, backslashes, reserved root paths and paths outside the physical root. Symlink metadata retains existing declared-target behavior. Node-side entries are private inputs; use `projectListingEntry` before public serialization. Reads are not a transactional filesystem snapshot and are not qualified against adversarial concurrent directory replacement.

Stable also adds validated public `entryData` annotations and static `fileHref` mapping for existing CDN files. See the [API guide](https://vp-tw.github.io/dirwell/api-reference/#public-annotations-and-file-url-mapping-upcoming-stable) for callback timing and public-data boundaries.

## Stable runtime validation

JavaScript callers receive the same recognized-option checks as typed consumers: unknown keys, invalid booleans/enums and malformed sort, symlink or listing plans fail before publication writes. Errors name the complete option path and suggest the closest known key. For example, `exlcude` is rejected with a suggestion for `exclude`; `mirror: "false"` is rejected rather than treated as truthy. A listing-policy callback runs after directory inspection, and its returned plan is validated before output replacement.

Custom theme objects may carry extra private fields. Their required name/render and known hooks must match the theme contract. Metadata and annotation callbacks remain trusted executable host code and are awaited where the public contract is asynchronous. These controls are included in `0.0.1`.

The 0.0.x API may evolve. Pin your qualified version and upgrade the official family together. See [support and verification](https://vp-tw.github.io/dirwell/support/) for host, browser and device boundaries.
