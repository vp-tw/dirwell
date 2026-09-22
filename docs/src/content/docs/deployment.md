---
title: Deployment
description: Publish SSG or MPA output to a static host.
---

Run `dirwell build` and deploy the output directory as ordinary static files.

## SSG mode

SSG mirrors source files and fills directory indexes that are missing. It is the
default for a browsable artifact or download tree.

## MPA mode

MPA emits an independently navigable document per generated directory. Themes
must not require a client router, and directory navigation works without
JavaScript.

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
