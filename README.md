# Dirwell

Dirwell turns a directory into a static file explorer. Build files for a static
host, or serve a changing folder locally. Choose SSG for portable output and
MPA when many directory pages should share assets.

## Quick start

```bash
pnpm install
pnpm dirwell serve ./fixture
pnpm dirwell build ./fixture -o ./generated
```

These commands run from a repository checkout. The first starts a watch server;
the second writes a static tree. The installed CLI uses the same `dirwell`
commands. Existing `index.html` and `index.htm` files are preserved; Dirwell
uses `_dirwell.html` for those directories when that name is available.

| Need                                 | Start with                                  |
| ------------------------------------ | ------------------------------------------- |
| Move the output tree between paths   | SSG and relative URLs, the defaults         |
| Publish beneath a fixed path         | `base` plus `urls: "base"`                  |
| Share assets across many pages       | `mode: "mpa"`                               |
| Show only selected source files      | `include` and `exclude`                     |
| Change icons or a few UI parts       | `createDefaultTheme({ icons, components })` |
| Render basic HTML without JavaScript | `createPlainTheme()`                        |

The [configuration guide](./docs/src/content/docs/configuration.md) lists
accepted values, defaults, effects, and use cases for every field.

```text
dirwell [directory]          # alias for serve
dirwell serve [directory]    # watch and live reload
dirwell build [directory]    # generate static output
dirwell daemon start [dir]   # detached server
dirwell daemon status
dirwell daemon stop
```

## Configuration

Create `dirwell.config.ts` when a field has no CLI flag or you want a reusable
setup:

```ts
import { defineConfig } from "dirwell";

export default defineConfig({
  mode: "mpa",
  base: "/downloads/",
  urls: "base",
  include: ["**/*.md", "assets/**"],
  exclude: ["drafts/**"],
});
```

Run `pnpm dirwell build ./public -o ./dist` to use it. The CLI's positional
directory defaults to `.` and overrides config `root`, so pass the source
path in the command.

`outputName` accepts a fixed filename or a function receiving `DirectoryData`.
Returning `null` skips the current directory. The default uses `index.html`,
then `_dirwell.html` when an index already exists, then skips if both exist.

`include` and `exclude` accept root-relative glob patterns. They select mirrored
files, generated directory pages, and search results; exclusions win. With no
patterns, every source entry is included.

URL generation supports portable depth-aware `relative` links, Vite-style
`base` prefixes for deployments such as GitHub Pages, and native
`html-base` documents using `<base href>`.

## Output modes

- `ssg` emits a page and runtime asset in every generated directory. This is
  the default and works on simple static hosts.
- `mpa` keeps every directory directly addressable while sharing runtime
  assets from the output-root `__dirwell/` directory. The default theme moves
  directories over 500 entries into a per-directory data asset and renders only
  nearby rows, so these pages require JavaScript.

`__dirwell/` is reserved in both modes for generated assets such as broken-link
raw views.

## Vite integration

The `dirwell/vite` adapter builds one or more explorers alongside a Vite
application and serves them through Vite's development server:

```ts
import { defineConfig } from "vite";
import Dirwell from "dirwell/vite";

export default defineConfig({
  plugins: [
    Dirwell([
      { root: "./docs", outDir: "dist/docs" },
      { root: "./downloads", outDir: "dist/downloads", mode: "mpa" },
    ]),
  ],
});
```

By default, Dirwell writes to a dedicated `dirwell/` subdirectory of Vite's
`build.outDir` and derives its public `base` from Vite's base path. Set
`outDir: "dist/downloads"` for another path relative to the Vite project root,
or set an absolute `outDir` for an independent publish directory. An output
outside Vite's build directory needs an explicit public `base`. The adapter
never replaces Vite's output root or an existing directory it does not own.
See [configuration](./docs/src/content/docs/configuration.md#vite-adapter) for
the full path and development-server behavior.

## Browser behavior

SSG pages and smaller MPA pages work without JavaScript. The runtime adds local and global
fuzzy search, type filters, configurable sorting, IME-safe keyboard controls,
Backspace parent navigation, theme persistence, and watch-mode live reload. The
global search index is fetched only after the user opens Search all files and types a query.
The index is split into bounded files; the first 100 best matches render progressively.
Search matches file names, relative paths, and symlink targets. Three independent
type controls filter physical folders, physical files, and symlinks. All are on by
default; any combination is available in the current folder and global search.

Name sorting supports raw Unicode code-point order, locale-aware comparison,
and natural numeric comparison. Modified time and file size are also available;
direction and directory grouping are independent controls.

The default theme shows modified times in the viewer's local time zone when
JavaScript is available. Generated HTML displays labeled UTC times before the
runtime loads and when JavaScript is disabled. The plain theme always displays UTC.

## Symlinks

Symlinks always remain visible and show their declared target. Broken links can
open their raw target text; targets outside the configured root remain
unavailable. Broken links, outside-root targets, and cycles receive explicit states.
Following directory links is opt-in. Ancestor cycles remain navigable but are
never expanded recursively.

## Themes

Replace the complete `ExplorerTheme` or layer typed component overrides over
the default theme. See [THEMING.md](./THEMING.md) and the Starlight site in
`docs/`.

`createPlainTheme()` provides a separate browser-native listing with no
icons, JavaScript, appearance controls, or search index. It emits complete HTML
in both modes; choose the default theme for search and large-directory
virtualization. See [examples/plain](./examples/plain).
Its footer shows the repository, author, and license. Pass `project` to
`createPlainTheme()` to override the metadata and link to a published repository.

The default theme uses selected self-hosted `vscode-icons` artwork for common
file types. The icons are CC BY-SA 4.0 and may include separately protected
brand marks; Dirwell's code remains MIT-licensed. See
[Ledger theme attribution](./src/theme-default/README.md),
[third-party notices](./THIRD_PARTY_NOTICES.md), and the
[file-icons example](./examples/file-icons).

## Development

```bash
pnpm install
pnpm test
pnpm exec playwright install chromium --only-shell
pnpm test:browser
pnpm run check
pnpm run build
pnpm run docs:build
```

Dirwell is MIT licensed.
