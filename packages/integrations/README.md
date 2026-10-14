# @dirwell/integrations

Explicit-theme static build adapters for Vite and unplugin hosts. No default theme, framework theme, image renderer or implicit config loader is installed. Configure the adapter in the host's configuration file; this package does not discover `dirwell.config.*` or process `extends`.

```js
import dirwell from "@dirwell/integrations/vite";
import { createPlainTheme } from "@dirwell/theme-plain";

export default {
  plugins: [dirwell({ root: "files", outputPath: "downloads", theme: createPlainTheme() })],
};
```

The `/rollup`, `/rolldown`, `/webpack`, `/rspack`, `/rsbuild`, `/esbuild`, `/farm` and `/bun` exports use the existing host lifecycles and a dedicated `outputPath`. A `theme` is always required; `metadata` accepts a core MetadataProviderFactory. Array configurations must use non-overlapping output paths. Output ownership, symlink containment and stale-asset protections remain enabled.

The adapters retain existing build/watch and Vite/Farm generated-preview behavior. They do not turn static build-watch into live server mode. For data that should update on requests without rebuilding, mount `@dirwell/server` in the host or proxy a standalone CLI server. Theme-source edits remain owned by the framework compiler. Farm standalone build-watch remains limited; package availability does not imply host feature parity.
