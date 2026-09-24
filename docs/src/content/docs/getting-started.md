---
title: Getting started
description: Serve or build your first Dirwell explorer.
---

Dirwell needs no configuration file for its default workflow.

## Serve a directory

```bash
pnpm dlx dirwell ./public
```

Dirwell watches the directory, rebuilds changed pages, and reloads connected
browsers. With no directory argument it serves the current directory.

## Build static output

```bash
pnpm dlx dirwell build ./public --out-dir ./dist
```

The output is a static directory tree suitable for any file host. Existing
`index.html` and `index.htm` files are preserved by default. When either exists,
Dirwell writes `_dirwell.html` if that name is available.

## Add configuration when needed

Create `dirwell.config.ts` only when the defaults stop being sufficient:

```ts
import { defineConfig } from "dirwell";

export default defineConfig({
  root: "./public",
  outDir: "./dist",
  symlinks: { follow: true, boundary: "root", onCycle: "skip" },
});
```
