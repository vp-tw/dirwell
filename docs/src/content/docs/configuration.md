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

## Sorting

`sort.field` accepts `name`, `modified`, or `size`. Name sorting supports
`unicode` code-point order, locale-aware `locale` comparison, and `natural`
comparison for names such as `file2` and `file10`. `direction` and
`directoriesFirst` are independent, so descending order does not force folders
to the bottom.

The default theme exposes the same choices at runtime and remembers the user's
preference locally. Set `sorting: false` in `createDefaultTheme()` to omit those
controls while retaining the generated order.

The built-in themes display modified times in UTC with an explicit `UTC` label.
The generated HTML is readable without JavaScript and shows the same time in
every viewer's time zone. The `<time datetime>` value preserves the instant;
sorting uses that instant rather than the displayed text. Custom themes can
format dates differently.

## Global search

The generated `__dirwell/search-index.json` is a manifest for smaller search
index files. They contain paths and display metadata, not file contents. The
default theme starts with the current directory and fetches the manifest only
after the user opens Search all files and types a query. Results stay in the
search panel; the current directory does not change. The best 100 matches render
progressively while the remaining index files load. Independent checkboxes filter
physical folders, physical files, and symlinks. All three are selected by default;
any combination works in both the current folder and global search. Clearing all
three shows a prompt to select a type and does not load the global index.

In MPA mode, the default theme puts directories with more than 500 entries in a
per-directory data asset and uses a measured virtual list. Row heights are
remeasured when names wrap or the viewport changes. These large MPA pages need
JavaScript; filtering and sorting run in a Web Worker when available, with a
main-thread fallback. SSG keeps full HTML for no-JavaScript browsing. Set
`virtualizeAfter` in `createDefaultTheme()` to change the threshold.
