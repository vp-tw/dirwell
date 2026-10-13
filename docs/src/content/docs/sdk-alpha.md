---
title: SDK alpha and package migration
description: Explicit themes, static builds, live server mode and the optional package boundaries.
---

The nine `@dirwell/*` packages are published at `0.0.1-alpha.1`, tagged `alpha`. The [SDK release](https://github.com/vp-tw/dirwell/releases/tag/%40dirwell/workspace%400.0.1-alpha.1) passed registry integrity, signatures, provenance and installed-consumer checks. The existing installation guides and public examples use the published `@vp-tw/dirwell` compatibility package; the examples below use the new SDK imports.

## Choose a mode

| Need                                            | Use                          | Update timing                                                             |
| ----------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| Portable files or CDN output                    | `@dirwell/core` static build | Rebuild before changed files appear                                       |
| A standalone local HTTP explorer                | `@dirwell/cli` server        | Directory facts are read on requests                                      |
| Explorer routes in an existing Node application | `@dirwell/server`            | Same live handler; host owns authentication and mounting                  |
| Static output inside a bundler build            | `@dirwell/integrations`      | Host build/watch lifecycle                                                |
| Browser updates without navigation              | Server with optional `live`  | Shared per-directory polling emits SSE; rich themes refresh coherent data |

Server mode handles file data without a Farm/compiler watcher. Theme source still needs its framework compiler; server mode does not provide framework HMR. Existing integrations retain their generated previews and build-watch limits.

## Install only the capabilities you need

Core requires an explicit theme. CLI `0.0.1-alpha.1` includes Plain by default; its behavior is described below. Plain emits native HTML with no JavaScript, image, font or icon assets by default. Ledger uses Svelte; Crosswave uses Vue and VueUse gamepad support. `@dirwell/share-image` supplies optional build-time metadata/PNG images. `@dirwell/integrations` supplies explicit-theme build adapters. Core and Plain do not depend on either optional package.

The nine packages have separate dependency graphs, but share one official alpha version. The minimum **verified** Node version is 22.12; publishing tools use Node 26. Physical gamepads and production-scale performance remain unverified.

## CLI: minimal default and project configuration

CLI `0.0.1-alpha.1` includes Plain by default. The commands below use the
published `alpha` tag. Core and integrated HTML continue to require an explicit
theme. The earlier `0.0.1-alpha` CLI required a project-installed theme.

```sh
npx @dirwell/cli@alpha server ./files
npx @dirwell/cli@alpha build ./files --out ./generated
```

New and compatibility CLIs both expose `dirwell`; replace the old CLI dependency
in a project rather than installing both. The CLI rejects legacy config discovery
instead of silently dropping its rules. Use native `.mjs` or explicit `--config`.

The CLI reads `dirwell.config.mjs` from the working directory without a config
loader or TypeScript compiler. Install a rich theme locally before importing it:

```sh
npm install --save-dev @dirwell/cli@alpha @dirwell/theme-ledger@alpha
```

```mjs
import { createLedgerTheme } from "@dirwell/theme-ledger";

export default {
  theme: createLedgerTheme({ title: "Downloads" }),
  build: { exclude: ["drafts/**"] },
  server: { exclude: ["drafts/**"], port: 3000 },
};
```

Then `npx dirwell server ./files` uses that theme. `--config ./other.mjs` selects
another native JavaScript module. Theme precedence is `--theme`, `config.theme`,
then Plain; `--theme ledger` and `--theme crosswave` are explicit shortcuts.
Explicit errors do not silently become Plain. Server port precedence is
`--port`, `PORT`, `config.server.port`, then an ephemeral port. Use `--live` for
automatic rich-client updates; refreshing/navigating Plain reads fresh data
without any client script.

Keep a dedicated `--out` for builds. Server-only flags fail in build mode and
build-only flags fail in server mode. See the [CLI package guide](https://github.com/vp-tw/dirwell/blob/main/packages/cli/README.md)
for custom module factories and full configuration behavior.

## Static output and listing policy

```js
import { generateExplorer } from "@dirwell/core";
import { createPlainTheme } from "@dirwell/theme-plain";

await generateExplorer({
  sourceDir: "files",
  outputDir: "public/downloads",
  theme: createPlainTheme(),
  listing: ({ visibleCount }) =>
    visibleCount > 500
      ? { html: { strategy: "paged", pageSize: 100 }, data: { strategy: "blocks", blockSize: 200 } }
      : { html: { strategy: "all" }, data: { strategy: "all" } },
});
```

HTML publication and compact listing data are independent decisions. The callback is synchronous and runs per directory; it also receives path, UTF-8 data bytes, operation and pagination capability. The example threshold is a configurable policy, not a universal optimum. Plain's native pagination works without JavaScript. Rich themes load complete data before directory-wide filtering/sorting; Ledger uses row virtualization for large lists, while Crosswave currently renders its filtered rows.

The CLI equivalent selects the factory explicitly:

```sh
dirwell build files --out public/downloads --theme @dirwell/theme-plain#createPlainTheme
dirwell server files --theme @dirwell/theme-ledger#createLedgerTheme --live
```

## Standalone and integrated HTTP

```js
import { startExplorerServer } from "@dirwell/server/node";
import { createLedgerTheme } from "@dirwell/theme-ledger";

const server = await startExplorerServer({
  root: "files",
  theme: createLedgerTheme(),
  live: { intervalMs: 1000 },
});
console.log(server.url);
// Stop accepting requests, cancel connections and await resource cleanup.
await server.close();
```

Standalone defaults bind loopback and preview raster images/audio/video; HTML, SVG and other files download with `nosniff`. Integrated file transport is opt-in. Native Node, Express, Fastify and Hono paths have executed tests. Filesystem access requires Node; this does not qualify edge runtimes or every framework host.

Use `createExplorerHandler` for Request/Response integration, or `createNodeRequestListener` for an existing Node server. Express and Fastify have dedicated package subpaths; Hono uses the shared Request/Response handler. Await creation before mounting. Use a dedicated `mountPath`, such as `/downloads`, without a trailing slash. Listing, theme assets, files and update events share that mount.

## Headers, authorization and freshness

```js
import { createExplorerHandler } from "@dirwell/server";
import { createPlainTheme } from "@dirwell/theme-plain";

const handler = await createExplorerHandler({
  root: "files",
  mountPath: "/downloads",
  theme: createPlainTheme(),
  files: false,
  headers: async () => ({ "Cache-Control": "private, no-cache" }),
  authorize: async (request, path) => {
    // Replace with the host's real session/access policy.
    return request.headers.has("authorization") && !path.startsWith("private");
  },
});
```

Default responses use `no-store` and ETags. Async authorization and header hooks finish before conditional responses. Authorization checks requested and canonical paths; it does not redact individual child names inside an allowed directory. Authenticated responses reject public/shared-cache policy. File streaming supports conditional requests and a single byte range.

Optional SSE shares a poll per canonical directory, rechecks subscribers, coalesces slow consumers and releases polling after the last cancellation. A changed revision tells rich clients to fetch complete data; query state survives the committed refresh. Plain stays script-free. No shared response cache, distributed invalidation, replay log or retained historical snapshot is supplied.

## Metadata and migration

Metadata is opt-in through a core provider. `@dirwell/share-image` can supply titles, descriptions, canonical URLs and either a fixed/custom image or an explicit PNG preset. It is a build-time provider, not a live server image endpoint. Plain stays minimal when omitted.

Legacy imports, config discovery, default Ledger and old metadata presets remain in `@vp-tw/dirwell`. New integrations take host options explicitly and do not discover legacy config or process `extends`. New CLI commands do not silently translate legacy dev/daemon commands. Legacy component overrides are not a migration contract. New official source components and HMR use the separate authoring API described below.

The release workflow can prepare and qualify immutable tarballs without npm login. First publication and trusted-publisher setup remain a separate human-authenticated step. See the repository's [workspace release procedure](https://github.com/vp-tw/dirwell/blob/main/WORKSPACE_RELEASING.md).

## Official component authoring

The optional `@dirwell/theme-authoring` package compiles Ledger Svelte snippets or
Crosswave Vue slots into matching SSR/client bundles. Import an official
component from its theme's `/source` entry and model types from `/model`.
`buildFrameworkTheme({framework, component, output})` returns a `themeUrl` whose
`createTheme` factory works with the build API, CLI or production server.

`startAuthoringServer` from `@dirwell/theme-authoring/dev` serves trusted source on
loopback with native Vite HMR. It is separate from production server mode and
from file-revision SSE. CSS-only changes preserve state; wrapper/template edits
can remount children and reset search/selection. Core and Plain do not depend on
these tools. The published alpha includes both framework compilers and their matching SSR/client output.
