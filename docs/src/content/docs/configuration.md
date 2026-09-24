---
title: Configuration
description: Configure paths, output, themes, and symlink behavior with TypeScript.
---

Dirwell discovers `dirwell.config.ts` from `--cwd`. Configuration is loaded by
c12 and validated at runtime before filesystem work begins.

```ts
import { defineConfig } from "dirwell";

export default defineConfig({
  root: ".",
  outDir: "dist",
  mode: "ssg",
  mirror: true,
  sort: {
    field: "name",
    nameMode: "natural",
    direction: "asc",
    directoriesFirst: true,
  },
});
```

## Dynamic configuration

The config may be a function. The command is explicit so asynchronous timing
and command-specific behavior are predictable.

```ts
export default defineConfig(({ command }) => ({
  outDir: command === "serve" ? ".dirwell-preview" : "dist",
}));
```

## Extending local configuration

```ts
export default defineConfig({
  extends: "./dirwell.base.ts",
  root: "./downloads",
});
```

Remote extends are intentionally not part of the initial public contract. Local
layers keep builds reproducible and avoid executing configuration fetched over
the network.

## Output filename

`outputName` accepts a fixed filename or a function. The function receives
complete `DirectoryData` and returns a filename or `null`. Returning `null`
skips generation for that directory.

```ts
export default defineConfig({
  outputName(directory) {
    return directory.entries.some((entry) => entry.name === "landing.html") ? null : "index.html";
  },
});
```

## Include and exclude

By default, Dirwell includes every source entry. `include` and `exclude` accept
a glob or an array of globs relative to `root`, using `/` separators. A pattern
without `/` matches at the root; use `**/` to match at any depth. `**` also
matches dotfiles. Exclusions take precedence; use `exclude` instead of negated
`!` patterns.

```ts
export default defineConfig({
  include: ["**/*.md", "assets/**"],
  exclude: ["drafts/**", "**/*.secret"],
});
```

A matching directory includes its descendants. Parent directories remain when
needed to reach an included file. Excluding a directory removes its entire
subtree. The same selection controls mirrored files, generated directory pages,
and the search index in both SSG and MPA modes, including the watch server and
Vite adapter. Empty arrays leave that side of the filter unrestricted. A
symlink to a filtered-out target remains listed without a link and is not
mirrored.

## URL strategy

`relative` is the portable default. `base` prefixes every generated URL with
a Vite-style deployment base. `html-base` emits the native HTML `<base>`
element and makes every generated URL relative to it.

```ts
export default defineConfig({
  base: "/repository-name/",
  urls: "base", // "relative" | "base" | "html-base"
});
```

`base` may be a root-relative pathname or a complete HTTP(S) URL. Query
strings and fragments are rejected. Dirwell applies the strategy consistently
to files, directories, breadcrumbs, parent navigation, theme assets, and
broken-link raw views.

## Vite adapter

Import `dirwell/vite` in `vite.config.ts` to build and serve the explorer from
the same Vite project:

```ts
import { defineConfig } from "vite";
import Dirwell from "dirwell/vite";

export default defineConfig({
  base: "/my-app/",
  plugins: [Dirwell({ root: "./downloads", mode: "mpa", outDir: "dist/downloads" })],
});
```

The adapter loads `dirwell.config.ts` from the Vite project root, then applies
inline plugin options over it. The inline options use the same fields as
`DirwellConfig`, except `server` and `extends`; `extends` remains available in
the config file. The Vite adapter defaults to `urls: "base"` so links point to
the published mount. An explicit `urls` value takes precedence. `base` must use
a dedicated path; mounting over the Vite application root is rejected.

`outDir` is a filesystem path. A relative value resolves from the Vite project
root; an absolute value is used as given. Its default is `dirwell/` inside the
resolved Vite `build.outDir`. When `outDir` is inside the Vite output, Dirwell
derives `base` from Vite's base and the output subdirectory. An output outside
Vite's build directory is published separately and requires an explicit public
`base`. For example, `outDir: "/srv/downloads"` with `base: "/downloads/"`
generates files under `/srv/downloads` and uses `/downloads/` in links; Vite
does not include those files in its own artifact.

Dirwell owns the entire `outDir` subtree. The adapter refuses to replace Vite's
output root, a parent of that root or the source directory, and an existing
directory without its ownership marker. In development it serves a private
temporary build under the public `base` through Vite, watches the source with
Vite's watcher, and requests a browser reload after a successful rebuild. A
failed rebuild leaves the previous output available and reports an error in
Vite. When mirroring is enabled, the adapter rejects included absolute symlinks
and relative symlinks that escape the source directory; either could expose files
outside the published explorer. Excluded links are not mirrored. Set
`mirror: false` when those source links must remain visible as metadata without
copying files. Vite is the supported host; other unplugin hosts have not been
verified.

## Sorting

`sort.field` accepts `name`, `modified`, or `size`. Name sorting supports
`unicode` code-point order, locale-aware `locale` comparison, and `natural`
comparison for names such as `file2` and `file10`. `direction` and
`directoriesFirst` are independent, so descending order does not force folders
to the bottom.

The default theme exposes the same choices at runtime and remembers the user's
preference locally. Set `sorting: false` in `createDefaultTheme()` to omit those
controls while retaining the generated order.

The default theme displays modified times in the viewer's local time zone after
JavaScript loads, with the UTC offset shown beside the date. Generated HTML
uses an explicit UTC label, so it remains readable when JavaScript is disabled.
The plain theme always displays UTC because it has no JavaScript. The
`<time datetime>` value preserves the instant; sorting uses that instant rather
than the displayed text. Custom themes can format dates differently.

## Global search

The generated `__dirwell/search-index.json` is a manifest for smaller search
index files. They contain paths and display metadata, not file contents. The
default theme starts with the current directory and fetches the manifest only
after the user opens Search all files and types a query. Results stay in the
search panel; the current directory does not change. The best 100 matches render
progressively while the remaining index files load. Independent type controls filter
physical folders, physical files, and symlinks. All three are selected by default;
any combination works in both the current folder and global search. Clearing all
three shows a prompt to select a type and does not load the global index.

In MPA mode, the default theme puts directories with more than 500 entries in a
per-directory data asset and uses a measured virtual list. Row heights are
remeasured when names wrap or the viewport changes. These large MPA pages need
JavaScript; filtering and sorting run in a Web Worker when available, with a
main-thread fallback. SSG keeps full HTML for no-JavaScript browsing. Set
`virtualizeAfter` in `createDefaultTheme()` to change the threshold.
