---
title: Build tool adapters
description: Generate an explorer alongside applications built with Unplugin hosts.
---

Dirwell provides adapters for Vite, Rollup, Rolldown, webpack, Rspack, Rsbuild,
esbuild, Farm, and Bun. Each adapter emits ordinary explorer pages and mirrored
files alongside the host application's output. The host remains responsible for
its own output directory and deployment.

```ts
import Dirwell from "@vp-tw/dirwell/rollup";

export default {
  input: "src/main.js",
  output: { dir: "dist", format: "es" },
  plugins: [Dirwell({ root: "downloads", outputPath: "downloads", mode: "mpa" })],
};
```

Change the import suffix to match the host. webpack and Rspack take the returned
plugin in `plugins`; Rsbuild uses its own `plugins` array. For esbuild, pass it
to `build()` or `context()`. Bun runs the adapter inside `Bun.build()`.

```ts
import { build } from "esbuild";
import Dirwell from "@vp-tw/dirwell/esbuild";

await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  outdir: "dist",
  plugins: [Dirwell({ root: "downloads" })],
});
```

The `@vp-tw/dirwell/unplugin` entry exports the same adapters as properties, such as
`Dirwell.rollup(options)` and `Dirwell.webpack(options)`. An options array builds
separate explorers; their `outputPath` values must not overlap.

## Options and output ownership

`DirwellPluginOptions` accepts generator configuration such as `root`, `mode`,
`theme`, `include`, `exclude`, `base`, and `urls`, plus:

| Option       | Meaning                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cwd`        | Directory for config discovery and relative source paths. Defaults to the host project directory where available, otherwise the process working directory. |
| `outputPath` | Dedicated path inside the host output directory. Defaults to `dirwell`. Absolute paths and dot segments are rejected.                                      |

The non-Vite adapters use the host's output directory rather than the config's
`outDir`; CLI server settings do not apply. URLs default to portable relative
links. Set `base` and `urls` together when the deployment requires a fixed base.
The existing `@vp-tw/dirwell/vite` adapter also supports an independent `outDir` and
derives its base from Vite; see [configuration](./configuration.md#vite-adapter).

Dirwell never replaces the host output root. Existing files in its dedicated
path require a generated ownership manifest. It removes stale assets listed by
that manifest after a successful rebuild, while preserving sibling outputs.
Host-level options such as `clean` and `emptyOutDir` still belong to the host.
Do not place source files inside the host output or publish another plugin's
files beneath the same `outputPath`.

## Development and verification

| Host             | Verified behavior                                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite             | Build, multiple explorers, base paths, watch, development serving, and browser reload.                                                                                     |
| Rollup           | Build and native watch, including source creation and deletion. No native development server.                                                                              |
| Rolldown         | Build and watch, with a managed filesystem-to-module watch bridge for source creation and deletion. The bridge closes with the watcher.                                    |
| webpack / Rspack | Build and native watch with directory dependencies. Explorer files are compilation assets.                                                                                 |
| Rsbuild          | Build through its Rspack compilation.                                                                                                                                      |
| esbuild          | Build and `context().watch()` using a tracked injected module. `write: false` returns explorer assets in `outputFiles`.                                                    |
| Farm             | Build and development serving with an adapter-owned directory watcher and reload stream. Standalone Farm watch has not been verified for raw-file additions and deletions. |
| Bun              | `Bun.build()` and repeated builds after source changes. The adapter requires Bun 1.3 or later for end-of-build hooks; it does not create a development server.             |

The build suite exercises SSG and MPA output, original file contents, multiple
explorers, and stale-file removal with real host builds. Watch and browser tests
cover the capabilities listed above. A compatible adapter does not give a host
server features that its build API does not expose.
