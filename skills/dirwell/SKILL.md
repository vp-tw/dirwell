---
name: dirwell
description: Build, configure, test, document, or theme the Dirwell static file explorer in this repository.
---

# Dirwell

Preserve Dirwell's product boundary: one-command static file exploration with a
simple default experience and typed extension points.

## Work in this repository

- Use pnpm and the recorded Vite+ toolchain.
- Keep TypeScript compatible with the strict root `tsconfig.json`; do not weaken
  a compiler option to pass a change.
- Run `pnpm check`, `pnpm test`, and any changed app build before reporting a
  completed implementation.
- Use `pnpm docs:build` when documentation, public APIs, CLI behavior, or config
  behavior changes.

## Preserve these invariants

- Generated navigation works without client JavaScript.
- Existing `index.html` and `index.htm` documents are preserved by default.
- `outputName(directory)` may return `null` to skip a directory.
- Symlink cycles remain visible and link to their canonical generated target;
  traversal itself must terminate.
- Broken and out-of-root symlinks show their declared target but do not become
  usable links or expose resolved absolute machine paths.
- A destination outside generated Explorer pages opens in a new tab with opener
  isolation. Explorer-to-Explorer navigation remains in the same tab.
- Keyboard shortcuts do not run in editable controls or during IME composition.
- The default UI remains usable when search, keyboard behavior, color switching,
  or all runtime JavaScript is disabled.

## Public surfaces

Treat these as coordinated public contracts:

- `DirectoryData`, file metadata, navigation decisions, and theme context.
- `dirwell.config.ts` and `defineConfig()`.
- `dirwell`, `build`, `serve`/`dev`, and `daemon` CLI help.
- Stable theme component names and their props.
- Documentation examples.

When one surface changes, update its runtime validation, tests, help, and docs in
the same change. Keep theme components independent of filesystem access: core
passes serializable view models into renderers.

Read `ARCHITECTURE.md` before moving package boundaries. Read `THEMING.md` before
adding or changing a replaceable component. Use the generated Starlight site in
`docs/` for user-facing guidance rather than expanding this skill into a manual.
