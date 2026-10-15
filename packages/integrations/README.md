# @dirwell/integrations

Requires Node.js 22.12 or later. [Read the guide](https://vp-tw.github.io/dirwell/build-tools/).

Explicit-theme static build adapters for Vite and unplugin hosts. No default theme, framework theme, image renderer or implicit config loader is installed. Configure the adapter in the host's configuration file; this package does not discover `dirwell.config.*` or process `extends`.

## Build with Vite

```sh
npm install --save-dev vite @dirwell/integrations@0.0.3 @dirwell/theme-plain@0.0.3
```

Create `files/note.txt` and an `index.html` for your host page. Save the following as `vite.config.mjs`, then run `npx vite build`:

```js
import dirwell from "@dirwell/integrations/vite";
import { createPlainTheme } from "@dirwell/theme-plain";

export default {
  plugins: [dirwell({ root: "files", outputPath: "downloads", theme: createPlainTheme() })],
};
```

The host output now contains `dist/downloads/index.html` and the selected file. Serve the complete `dist` directory over HTTP and open `/downloads/`. Vite needs its normal host entry page; Dirwell supplies the explorer subtree.

The `/rollup`, `/rolldown`, `/webpack`, `/rspack`, `/rsbuild`, `/esbuild`, `/farm` and `/bun` exports use the existing host lifecycles and a dedicated `outputPath`. A `theme` is always required; `metadata` accepts a core MetadataProviderFactory. Array configurations must use non-overlapping output paths. Output ownership, symlink containment and stale-asset protections remain enabled.

The adapters retain existing build/watch and Vite/Farm generated-preview behavior. They do not turn static build-watch into live server mode. For data that should update on requests without rebuilding, mount `@dirwell/server` in the host or proxy a standalone CLI server. Theme-source edits remain owned by the framework compiler. Farm standalone build-watch remains limited; package availability does not imply host feature parity.

## Stable configuration validation

Unknown top-level and nested sort/symlink/listing keys fail before the adapter publishes output. Errors name the config path and suggest the closest known key. `cwd` and `outputPath` belong to adapters; server startup belongs to the host. `defineConfig` validates object configuration immediately and retains lazy callback factories; their resolved result must pass validation when supplied to the adapter. These checks are included in `0.0.1`.

The 0.0.x API may evolve. Pin your qualified version and upgrade the official family together. See [support and verification](https://vp-tw.github.io/dirwell/support/) for host, browser and device boundaries.

## Directory URLs

Version 0.0.3 uses Core `routing: { directoryUrls: "explicit" }` by default
for every theme. Choose `slash` for directory-index hosts or `clean` for a
qualified extensionless host. Themes do not rewrite links. Existing source
homepages and download names are preserved; output conflicts fail. CLI config
puts routing at the top level, and `--directory-urls` overrides it.
See [directory URL guidance](https://vp-tw.github.io/dirwell/urls/) for output
placement, host requirements, native Plain file navigation and migration.
