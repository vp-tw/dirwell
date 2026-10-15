---
title: Build tool adapters
description: Generate static explorers inside an existing build with explicit themes.
---

Install the adapter package and the theme you want:

```sh
npm install --save-dev @dirwell/integrations @dirwell/theme-plain
```

```js
import { defineConfig } from "vite";
import dirwell from "@dirwell/integrations/vite";
import { createPlainTheme } from "@dirwell/theme-plain";

export default defineConfig({
  plugins: [dirwell({ root: "files", outputPath: "downloads", theme: createPlainTheme() })],
});
```

The host's output contains the dedicated explorer subtree. Adapters require an explicit theme and take host options directly. They do not discover `dirwell.config.*`, inherit config or install a default theme/image renderer. `metadata` accepts a core metadata provider from the optional [share-image package](../metadata/).

## Host entrypoints

| Tool     | Import                           |
| -------- | -------------------------------- |
| Vite     | `@dirwell/integrations/vite`     |
| Rollup   | `@dirwell/integrations/rollup`   |
| Rolldown | `@dirwell/integrations/rolldown` |
| webpack  | `@dirwell/integrations/webpack`  |
| Rspack   | `@dirwell/integrations/rspack`   |
| Rsbuild  | `@dirwell/integrations/rsbuild`  |
| esbuild  | `@dirwell/integrations/esbuild`  |
| Farm     | `@dirwell/integrations/farm`     |
| Bun      | `@dirwell/integrations/bun`      |

These subpaths expose default adapter factories using the host's lifecycle. Arrays require non-overlapping output paths. Output ownership, containment and stale-asset checks remain enabled. Vite/Rollup/webpack are primary qualified paths; other adapters have bounded installed-consumer checks, not identical dev/watch guarantees.

## Executed primary host modes

| Host    | Version | Executed behavior                                                                                                 |
| ------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| Vite    | 8.3.0   | Isolated installed build and generated development preview; ordinary source creation/deletion updates the preview |
| Rollup  | 4.64.2  | Isolated installed build/watch; creation/deletion updates listing and removes stale mirrored files                |
| webpack | 5.111.1 | Isolated installed build/watch; creation/deletion updates listing and removes stale mirrored files                |

These specific modes are qualified; other host/version/framework combinations need their own proof. See [the current SDK verification record](https://github.com/vp-tw/dirwell/blob/main/VERIFICATION.md). Source compiler HMR and server data SSE are separate below.

## Pick the update mechanism

Static build-watch follows the host lifecycle and rebuilds generated output. It does not become live server mode. For files that should update on requests, mount `@dirwell/server` or proxy a standalone CLI server. For Svelte/Vue source changes, use `@dirwell/theme-authoring/dev`.

Farm standalone watch cannot reliably detect arbitrary non-module changes. Verify the host mode you intend to use; framework plugins and adapter interfaces alone do not prove runtime integration.

## Directory routing in build adapters

Supply `routing: { directoryUrls: "explicit" }` in the adapter options. Adapters forward the Core contract and do not inspect CLI config files. A host dev preview does not establish production rewrite behavior. In clean mode, check real file and host-application routes before publishing. See [directory URLs](../urls/).
