---
title: Deployment
description: Choose output and URL settings that match your static host.
---

Run `dirwell build` and publish its entire output directory. Dirwell writes
ordinary HTML and assets; a static file host can serve them without a Dirwell
server.

## Choose the output mode

| Mode            | Result and trade-off                                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ssg` (default) | Each directory gets a page and its theme assets. Choose it for portable output and complete list HTML. Repeated assets can make a large tree bigger.                                             |
| `mpa`           | Each directory gets a page; runtime assets are shared under root `__dirwell/`. Choose it for many pages in one published tree. Large default-theme directories may need JavaScript to load rows. |

The default theme virtualizes an MPA directory only when it has more than
`500` entries, browser behavior is enabled, and the default list and row
components are in use. Set `virtualizeAfter` in `createDefaultTheme()` to
change the threshold. SSG and the plain theme keep complete list HTML.

## Choose the URL strategy

| Strategy             | Link result and use                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `relative` (default) | `file.zip` or `../file.zip`, based on page depth. Use it when the output tree may move.                                                        |
| `base`               | `/project/downloads/file.zip`. Use it when the host has a known path prefix.                                                                   |
| `html-base`          | A document-relative link plus `<base href="/project/downloads/">`. Use it when the host expects a base element; also check custom theme links. |

For a project site under `/project/`:

```bash
pnpm dirwell build ./downloads -o ./dist --base /project/downloads/ --urls base
```

Publish `dist/` at `/project/downloads/`. `base` changes generated links,
not the filesystem output location. A mismatch can leave pages reachable
while their assets or file links fail. A complete HTTP(S) `base` is also
accepted; queries and fragments are not.

## Existing index documents

For each source directory, the default naming rule preserves an existing
`index.html` or `index.htm` and writes `_dirwell.html` for the explorer.
If `_dirwell.html` already exists, Dirwell skips generation there. Other
explorer pages link to the generated fallback when it exists. A link that
leaves generated explorer pages opens the existing document in a new tab.

Set `outputName` only when your host needs another filename or when some
directories should have no explorer page. Its function can return `null`
for those directories.

## Vite and Pages

The [Vite adapter](../configuration/#vite-adapter) writes under
`build.outDir/dirwell/` by default and derives the public `base`. A custom
`outDir` inside Vite's build directory is included in that artifact. For an
absolute or relative path outside it, supply `base` and publish that second
directory yourself. The adapter will not overwrite Vite's output root or an
existing directory it does not own.

This repository's [six live examples](../examples/) are built from one
`Dirwell([...])` Vite configuration, then copied into the documentation's
GitHub Pages tree.

## Before publishing

1. Build the site and open a nested directory page, not only the root.
2. Follow a file link, a breadcrumb, and a theme asset URL under the final
   deployment prefix.
3. If you use MPA virtualization, test a directory above the threshold with
   JavaScript enabled. If no-script browsing is required, choose SSG or the
   plain theme.
4. Check existing `index.html` and `_dirwell.html` files to confirm the
   fallback behavior you expect.
