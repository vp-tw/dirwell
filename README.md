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
  outputName: (directory) =>
    directory.entries.some((entry) => entry.name === "index.html") ? null : "index.html",
  symlinks: { follow: true, boundary: "root", onCycle: "skip" },
  theme: createDefaultTheme({
    colorScheme: true,
    fuzzySearch: true,
    keyboardNavigation: true,
  }),
});
```

`outputName` receives `DirectoryData`: root, current directory, parent,
complete entry metadata, and symlink state. Returning `null` skips the current
directory.

## Output modes

- `ssg` emits a page and runtime asset in every generated directory. This is
  the default and works on simple static hosts.
- `mpa` keeps every directory directly addressable while sharing runtime
  assets from the output-root `__dirwell/` directory.

Both modes work without JavaScript. The optional runtime adds fuzzy search,
IME-safe keyboard controls, Backspace parent navigation, theme persistence, and
watch-mode live reload.

Symlinks always remain visible and show their declared target. Broken links,
targets outside the configured root, and cycles receive explicit states.
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
