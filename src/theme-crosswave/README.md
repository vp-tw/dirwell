# Crosswave

Crosswave is an optional Dirwell theme by [VdustR](https://github.com/VdustR).
It uses horizontal file categories, a vertical file list, and an original moving
wave background inspired by the PSP interface. Keyboard and standard-mapped
gamepads can navigate folders; native links remain available without JavaScript.

```ts
import { createCrosswaveTheme, defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  root: "files",
  theme: createCrosswaveTheme({ project: { name: "Downloads" } }),
});
```

`project.name` is your site's display name. The header identifies the theme
separately as **Crosswave by VdustR**. Categories, colors, motion, and navigation
options are described in the [theme guide](../../THEMING.md#crosswave-renderer).

Crosswave browses and opens published files. It does not provide a media player
or file previews. Its graphics and icons are original Dirwell artwork, licensed
under the [MIT License](../../LICENSE). Crosswave is not affiliated with Sony.

## Fonts and share images

The theme uses bundled Adobe Source fonts with pinned sources and SIL-OFL notices. Generated output includes `source-fonts-NOTICE.txt`; package sources and licenses are in [`src/fonts`](../fonts/). Shared config `metadata` controls titles, descriptions, and image sources/callbacks. See [page metadata and share images](https://vp-tw.github.io/dirwell/metadata/).
