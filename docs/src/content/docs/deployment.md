---
title: Deployment
description: Publish SSG or MPA output to a static host.
---

Run `dirwell build` and deploy the output directory as ordinary static files.

## SSG mode

SSG mirrors source files and fills directory indexes that are missing. It is the
default for a browsable artifact or download tree.

## MPA mode

MPA emits an independently navigable document per generated directory and
shares runtime assets from `__dirwell/`. Themes do not need a client router.
With the default theme settings and row components, MPA keeps listings of up
to 500 entries in HTML. Above that threshold, it loads rows from a data asset
and renders a virtual list, so those large listings require JavaScript. The
`virtualizeAfter` option changes the threshold. Use SSG for complete listing
HTML without JavaScript.

## Existing index documents

The default resolver does not replace `index.html` or `index.htm`. When either
exists, it writes `_dirwell.html` and links to that page from other Explorer
pages. If `_dirwell.html` also exists, generation for that directory is skipped;
the directory link opens its existing index in a new tab. Links between generated
Explorer pages remain in the same tab.

## Verification

Before publishing, run:

```bash
pnpm check
pnpm test
pnpm docs:build
```
