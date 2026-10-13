---
title: Themes and source customization
description: Choose Plain, Ledger or Crosswave, or own the renderer.
---

CLI includes Plain. Core and integrations require a theme explicitly. Install only what your project uses.

| Theme     | Package                    | Behavior                                                                 |
| --------- | -------------------------- | ------------------------------------------------------------------------ |
| Plain     | `@dirwell/theme-plain`     | Native HTML, links and pagination; no JavaScript/assets by default       |
| Ledger    | `@dirwell/theme-ledger`    | Svelte search, sorting, keyboard selection and large-list virtualization |
| Crosswave | `@dirwell/theme-crosswave` | Vue crossbar, categories, keyboard and gamepad navigation                |

```js
import { createLedgerTheme } from "@dirwell/theme-ledger";
export default { theme: createLedgerTheme({ title: "Downloads" }) };
```

Save as `dirwell.config.mjs` after installing CLI and Ledger. Rich themes load complete coherent listing data before enabling directory-wide filters. Native HTML pagination remains usable without JavaScript; it is independent of interactive row virtualization.

## Crosswave options

```js
import { createCrosswaveTheme, defaultCrosswaveCategories } from "@dirwell/theme-crosswave";

export default {
  theme: createCrosswaveTheme({
    title: "Media library",
    color: "jade",
    gamepad: true,
    backgroundMotion: true,
    categories: defaultCrosswaveCategories,
  }),
};
```

Categories have unique ids, labels, icons and extension/MIME match rules. MIME inference happens on Node, not through a browser database. Inspect the [category example](https://github.com/vp-tw/dirwell/tree/main/examples/crosswave-categories) for ordering, custom SVG and overlapping rules.

Plain accepts `project` attribution options and `portableLinks`; its normal minimal mode emits no footer/image/font assets. Page metadata belongs in the optional [metadata provider](../metadata/), independently of theme selection.

## Source component customization

Install `@dirwell/theme-authoring@alpha` for trusted source customization. Wrap Ledger from `@dirwell/theme-ledger/source` in Svelte, or Crosswave from `@dirwell/theme-crosswave/source` in Vue. Both expose header, row and footer extension contexts. Row content lives inside the official link; do not nest interactive controls.

```js
import { buildFrameworkTheme } from "@dirwell/theme-authoring";
const result = await buildFrameworkTheme({
  framework: "svelte",
  component: "./Ledger.svelte",
  output: "./generated-theme",
});
const { createTheme } = await import(result.themeUrl);
export default { theme: createTheme({ title: "Downloads" }) };
```

Compile matching SSR/client output before using it in a build or server. Rebuilds require a fresh import and renderer instance. `@dirwell/theme-authoring/dev` supplies loopback-only native HMR; CSS-only edits preserve state, while wrapper/script edits can remount children. It is separate from production file-data SSE. See [complete source wrappers](https://github.com/vp-tw/dirwell/tree/main/examples/authoring).

## Independent themes

Implement `ExplorerTheme` from `@dirwell/core`: `name` and `render(context)` returning a complete HTML document plus optional assets. Escape filenames and other untrusted text. Do not serialize absolute source paths, inode/ownership data or raw stat objects. Use public listing records for client data. Opt into pagination only if the renderer emits native page links. See [API reference](../api-reference/).
