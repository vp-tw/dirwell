---
title: Configuration
description: Choose output, URLs, filters, sorting, themes, and server settings.
---

Start with `ssg`, relative URLs, and the default theme. Change a setting when
you need a specific result:

| Need                                             | Start with                             |
| ------------------------------------------------ | -------------------------------------- |
| Publish one portable folder                      | `dirwell build ./files` with no config |
| Publish under a fixed URL prefix                 | `base` and `urls: "base"`              |
| Share runtime assets across many directory pages | `mode: "mpa"`                          |
| Publish only selected files                      | `include` and `exclude`                |
| Customize the explorer interface                 | `theme: createDefaultTheme(...)`       |
| Serve several explorers from one Vite project    | `Dirwell([...])`                       |

## Where settings come from

Create `dirwell.config.ts` in the directory selected by `--cwd`. The CLI loads
it before resolving paths. The Vite adapter loads the file from the Vite project
root and applies each plugin entry over it. The TypeScript API can pass
`GenerateOptions` directly to `generateExplorer()`.

`defineConfig()` preserves types. A config can also be a synchronous or
asynchronous function receiving `{ command: "build" | "serve" | "daemon" }`:

```ts
import { defineConfig } from "dirwell";

export default defineConfig(({ command }) => ({
  outDir: command === "serve" ? ".dirwell-preview" : "dist",
}));
```

For the CLI, an explicit flag overrides the corresponding config field.
`[directory]` overrides `root`, including when the argument is omitted: the
CLI's positional default is `.`. Pass the desired directory explicitly when
using the CLI. Relative config paths resolve from `--cwd`; Vite plugin paths
resolve from the Vite project root.

`extends` accepts a local path or an array of local paths. Use it to share
settings across builds, then set project-specific fields in the current config:

```ts
export default defineConfig({
  extends: "./dirwell.base.ts",
  outDir: "./dist",
});
```

## Input and output

| Field        | Input and result                                                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root`       | Directory path; default `.`. Sets the source tree. The CLI positional directory, also defaulting to `.`, overrides it.                            |
| `outDir`     | Directory path; default `dist/` for build or `.dirwell-preview/` for serve and daemon. Dirwell replaces this tree, so keep other files elsewhere. |
| `mode`       | `"ssg"` or `"mpa"`; default `"ssg"`. Choose MPA when many pages should share assets.                                                              |
| `mirror`     | Boolean; default `true`. Copies selected source files. Set `false` only when another publisher supplies the files that page links need.           |
| `outputName` | Safe filename or sync/async function returning a filename or `null`; default resolver. Names each directory page; return `null` to skip one.      |

`ssg` writes a directory page and its theme assets in each generated directory.
It suits a portable tree with simple hosting. `mpa` also writes a page per
directory but shares runtime assets in the output root's `__dirwell/` directory.
With the default theme, MPA directories above `virtualizeAfter` entries load rows
from a data asset and need JavaScript for the list. See [deployment](../deployment/)
for the trade-offs.

The default filename rule is:

1. Write `index.html` if neither `index.html` nor `index.htm` exists.
2. Otherwise write `_dirwell.html` if that name is free.
3. If both names are taken, skip the generated page for that directory.

Dirwell preserves the existing index. Links from other generated pages point to
`_dirwell.html` when it was created. A fixed `outputName: "listing.html"` uses
that name for every directory. A function can inspect `DirectoryData.entries`:

```ts
export default defineConfig({
  outputName(directory) {
    return directory.entries.some((entry) => entry.name === "landing.html") ? null : "index.html";
  },
});
```

The name must be one filename, without a directory separator. `__dirwell/` at
the source root is reserved for generated assets. Dirwell excludes an output
directory nested inside the source from scanning it again. A custom filename
that matches a mirrored source file can replace that file in the output;
choose a distinct name when source documents must stay intact.

## Include and exclude

| Field     | Accepted value; default                           | Effect                                                                                    |
| --------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `include` | One source-relative glob or an array; all entries | Limits the source tree to matches. A matched directory includes its descendants.          |
| `exclude` | One source-relative glob or an array; none        | Removes matches even if `include` selected them. A matched directory removes its subtree. |

```ts
export default defineConfig({
  include: ["**/*.md", "assets/**"],
  exclude: ["drafts/**", "**/*.secret"],
});
```

Patterns use `/` separators and start relative to `root`. `*.md` matches at
the root; `**/*.md` matches at any depth. Dotfiles are included in matching.
Absolute paths, `..` segments, backslashes, and negated `!` patterns are
rejected. Empty arrays do not restrict that side of the filter.

Parent directories stay in the explorer when they lead to a selected file.
The same selection controls mirrored files, directory pages, and search
results in build, serve, and Vite modes. A symlink to an excluded target may
remain visible, but it has no usable link and is not mirrored.

## Public URLs

`base` accepts a root-relative path such as `/downloads/` or a complete
HTTP(S) URL. Its default is `/`. Query strings and fragments are rejected.
`urls` chooses how Dirwell writes links; its default is `"relative"` for CLI
and the TypeScript API.

| `urls` value  | Link result and use                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `"relative"`  | Resolves from each page's depth. Use it when the output tree may move between hosts or paths.               |
| `"base"`      | Prefixes with `base`, for example `/downloads/file.zip`. Use it for a known deployment mount.               |
| `"html-base"` | Adds `<base href="...">` and uses document-relative links. Check other relative links in custom theme HTML. |

```ts
export default defineConfig({
  base: "/project/downloads/",
  urls: "base",
});
```

The strategy applies to files, directory pages, breadcrumbs, theme assets, and
raw views of broken symlinks. A correct `base` must match the path where the
output is actually served. The Vite adapter defaults to `urls: "base"` and
derives `base` for output inside Vite's build directory.

## Sort order

`sort` changes the generated order. The default theme also offers browser
controls; a visitor's saved choice can change the displayed order.

| `sort` field       | Input and result                                                                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `field`            | `"name"`, `"modified"`, or `"size"`; default `"name"`. Compares names, modification instants, or file sizes.                                                                                      |
| `nameMode`         | `"natural"`, `"locale"`, or `"unicode"`; default `"natural"`. Natural puts `file2` before `file10`; locale uses the runtime locale; Unicode compares code points. Also breaks size and time ties. |
| `direction`        | `"asc"` or `"desc"`; default `"asc"`. Reverses the selected comparison.                                                                                                                           |
| `directoriesFirst` | Boolean; default `true`. Keeps directory-like entries first in either direction. Set `false` for one mixed sequence.                                                                              |

```ts
export default defineConfig({
  sort: { field: "modified", direction: "desc", directoriesFirst: true },
});
```

Directory-like symlinks group with directories. Size sorting treats directory
size as zero and uses names to break ties.

## Symlinks and themes

`symlinks` accepts `follow` (boolean, default `false`), `boundary`
(`"root"` or `"anywhere"`, default `"root"`), and `onCycle`
(`"skip"` or `"error"`, default `"skip"`). Start with
`{ follow: true, boundary: "root", onCycle: "skip" }` when internal directory
links should have browsable pages. See [symlink behavior](../symlinks/) before
using `"anywhere"` or publishing untrusted trees.

`theme` accepts an `ExplorerTheme`. The default theme includes search, sorting,
icons, and appearance controls. `createPlainTheme()` emits no JavaScript or
search index. `createDefaultTheme(options)` changes selected controls and
components without replacing the whole renderer. See [theme choices](../themes/).

## Server

`server` configures the CLI `serve` and `daemon start` commands. Vite uses
its own server configuration.

| Field         | Value; default                      | Use                                                                                    |
| ------------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| `server.host` | Hostname or address; `127.0.0.1`    | Set a different interface when the server must be reachable outside the local machine. |
| `server.port` | Integer from `0` to `65535`; `4173` | Use another port when the default is occupied; `0` asks the OS to choose one.          |

`--host` and `--port` take precedence over `HOST` and `PORT`, which take
precedence over config. See [CLI commands](../cli/) for `--cwd` and daemon
behavior.

## Vite adapter

Import `dirwell/vite` in a Vite config. Inline options accept the fields above
except `extends` and `server`. Each entry inherits the project
`dirwell.config.ts` before applying its own inline fields.

```ts
import { defineConfig } from "vite";
import Dirwell from "dirwell/vite";

export default defineConfig({
  base: "/my-app/",
  plugins: [
    Dirwell([
      { root: "./docs", outDir: "dist/docs", mode: "ssg" },
      { root: "./releases", outDir: "dist/releases", mode: "mpa" },
    ]),
  ],
});
```

One object returns one Vite plugin. An array returns one plugin per explorer.
Each entry needs its own output and public mount. An empty array or overlapping
output or mount paths fails configuration. The same entries serve through Vite
in development and generate output after a production build.

Vite resolves a relative `outDir` from the Vite project root; an absolute path
stays absolute. The default is `dirwell/` inside Vite's `build.outDir`. When the
output is inside that build directory, Dirwell derives the public `base` from
Vite's `base` and the output subdirectory. For output outside it, set `base`
explicitly and publish that directory yourself; Vite will not include it in
its artifact.

Dirwell owns each complete `outDir` subtree. The adapter refuses to replace
Vite's output root, the source directory, or an existing destination without
its ownership marker. It serves a temporary build in development, watches
source changes, and keeps the previous preview available after a failed
rebuild. With `mirror: true`, it rejects included absolute symlinks and links
that escape the source tree. Vite is the verified host; other unplugin hosts
have not been verified.
