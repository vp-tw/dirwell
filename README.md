# Dirwell

Dirwell turns a directory into a static, accessible file explorer. It supports
zero-config builds, a live-reloading development server, safe symlink traversal,
typed theme components, and deployable SSG or MPA output.

## Quick start

```bash
pnpm dlx dirwell .
pnpm dlx dirwell build . --out-dir dist
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
import { createDefaultTheme, defineConfig } from "dirwell";

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
  assets from the output-root `__dirwell/` directory.

`__dirwell/` is reserved in both modes for generated assets such as broken-link
raw views.

Both modes work without JavaScript. The optional runtime adds local and global
fuzzy search, type filters, configurable sorting, IME-safe keyboard controls,
Backspace parent navigation, theme persistence, and watch-mode live reload. The
global search index is fetched only after the user selects `Everywhere`.
Search matches file names, relative paths, and symlink targets. Folder and file
filters include matching symlinks by default, with an `Include links` toggle.

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

## Development

```bash
pnpm install
pnpm test
pnpm run check
pnpm run build
pnpm run docs:build
```

Dirwell is MIT licensed.
