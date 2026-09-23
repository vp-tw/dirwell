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

The default resolver does not replace `index.html` or `index.htm`. A link to a
directory with its own index opens in a new tab because it leaves the Explorer.
Links between generated Explorer pages remain in the same tab.

## Verification

Before publishing, run:

```bash
pnpm check
pnpm test
pnpm docs:build
```
