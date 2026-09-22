# Architecture

Dirwell is a static generator with a small progressive-enhancement runtime.
Node.js performs filesystem access and emits ordinary files. The browser never
receives machine paths or performs filesystem traversal.

## Build pipeline

1. Resolve `dirwell.config.ts` with c12.
2. Scan the source and serialize full file metadata into `DirectoryData`.
3. Classify symlinks as internal, broken, outside-root, or ancestor cycles.
4. Resolve every directory's output filename. `null` skips generation.
5. Plan all pages before rendering so link policy knows which directories have
   explorer pages.
6. Render into a sibling staging directory.
7. Replace the output only after a complete successful build.

A failed render leaves the last successful output intact.

## Output modes

SSG copies the small runtime beside every generated page. MPA emits the same
directly addressable HTML pages but shares runtime assets through the reserved
output-root `__dirwell/` directory. A source collision with that path is an
error in MPA mode.

Both modes mirror source files by default and preserve an existing
`index.html` or `index.htm`.

## Theme boundary

`ExplorerTheme.render(context)` owns the complete document and optional
assets. The default renderer is composed from eight typed HTML component
functions. Component layers are shallow, ordered overrides; a component may
wrap the exported default explicitly.

Themes receive prepared data and URL decisions. They do not read the
filesystem. Tokens remain private to a theme, so a replacement may change
markup, styling, icons, and browser behavior together.

## Link and symlink policy

- Generated directories navigate in the same tab.
- Files and preserved custom indexes open in a new tab.
- Internal symlinks use canonical root-relative targets.
- Broken and outside-root targets remain visible without a link.
- Ancestor cycles remain visible and navigable but are never expanded again.
- Directory symlink traversal is opt-in; the default boundary is the source
  root.

## Development server

The foreground server watches the source recursively, debounces changes, and
serializes rebuilds. Successful rebuilds notify browsers through server-sent
events. Failed rebuilds are logged while the prior atomic output remains
available. The daemon command launches this same server and records its PID and
log under `.dirwell/`.

## Toolchain

- Vite+ for formatting, linting, and library packaging
- TypeScript 7 with strict and additional safety flags
- pnpm with exact dependency versions
- Astro Starlight for the documentation site
- Node's test runner for filesystem and integration tests
