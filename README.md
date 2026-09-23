# Dirwell

Dirwell turns a directory into a static, accessible file explorer. It supports
zero-config builds, a live-reloading development server, safe symlink traversal,
typed theme components, and deployable SSG or MPA output.

## Quick start

```bash
pnpm dlx @vp-tw/dirwell .
pnpm dlx @vp-tw/dirwell build . --out-dir dist
```

The first command watches the current directory and serves it. `build` writes a
static site. Existing `index.html` and `index.htm` files are preserved.

```text
dirwell [directory]          # alias for serve
dirwell serve [directory]    # watch and live reload
dirwell build [directory]    # generate static output
dirwell daemon start [dir]   # detached server
dirwell daemon status
dirwell daemon stop
```

## Configuration

Create `dirwell.config.ts` only when defaults are insufficient:

```ts
import { createDefaultTheme, defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  root: "./public",
  outDir: "./dist",
  mode: "mpa",
  base: "/downloads/",
  urls: "base",
  outputName: (directory) =>
    directory.entries.some((entry) => entry.name === "index.html") ? null : "index.html",
  symlinks: { follow: true, boundary: "root", onCycle: "skip" },
  sort: {
    field: "name",
    nameMode: "natural",
    direction: "asc",
    directoriesFirst: true,
  },
  theme: createDefaultTheme({
    colorScheme: true,
    fuzzySearch: true,
    globalSearch: true,
    keyboardNavigation: true,
    sorting: true,
    project: {
      author: "Your name",
      repositoryUrl: "https://github.com/you/project",
      license: "MIT License",
      licenseUrl: "https://github.com/you/project/blob/main/LICENSE",
    },
  }),
});
```

`outputName` accepts a filename or receives `DirectoryData`: root, current
directory, parent, complete entry metadata, and symlink state. Returning `null`
skips the current directory.

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

SSG pages and smaller MPA pages work without JavaScript. The runtime adds local and global
fuzzy search, type filters, configurable sorting, IME-safe keyboard controls,
Backspace parent navigation, theme persistence, and watch-mode live reload. The
global search index is fetched only after the user opens Search all files and types a query.
The index is split into bounded files; the first 100 best matches render progressively.
Search matches file names, relative paths, and symlink targets. Three independent
checkboxes filter physical folders, physical files, and symlinks. All are on by
default; any combination is available in the current folder and global search.

Name sorting supports raw Unicode code-point order, locale-aware comparison,
and natural numeric comparison. Modified time and file size are also available;
direction and directory grouping are independent controls.

Symlinks always remain visible and show their declared target. Broken links can
open their raw target text; targets outside the configured root remain
unavailable. Broken links, outside-root targets, and cycles receive explicit states.
Following directory links is opt-in. Ancestor cycles remain navigable but are
never expanded recursively.

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
[third-party notices](./THIRD_PARTY_NOTICES.md) and the
[file-icons example](./examples/file-icons).

## Development

```bash
pnpm install
pnpm test
pnpm run check
pnpm run build
pnpm run docs:build
```

Release notes use Changesets. This repository remains in `alpha` prerelease
mode until a stable release is explicitly chosen. See [RELEASING.md](./RELEASING.md)
for the release procedure.

Dirwell is MIT licensed.
