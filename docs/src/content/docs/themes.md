---
title: Themes
description: Choose the default, plain, or complete renderer and configure its parts.
---

`theme` controls the generated HTML, styles, icons, and browser behavior.
Choose the smallest level of customization that gives you the page you need:

- `createDefaultTheme(options)` keeps the explorer and changes controls,
  icons, metadata, or selected components. See the [Catppuccin override](../examples/).
- `createPlainTheme()` renders prepared entries and safe links as basic HTML.
  Change project metadata only. See the [plain listing](../examples/).
- `createCrosswaveTheme()` provides PSP-inspired category navigation, animated
  light, and keyboard/gamepad controls. See [Crosswave](#crosswave).
- A complete `ExplorerTheme` uses prepared entries and safe links in your own
  document and assets. See the [release catalog](../examples/).

For a config that imports a theme, first [install Dirwell in your project](../getting-started/#3-save-project-settings-when-needed).
Ledger is the name of the default theme; `createDefaultTheme()` is its factory.

## Plain theme

`createPlainTheme()` writes complete, browser-native HTML in both SSG and MPA.
It has no icons, JavaScript, appearance controls, search index, or virtual
list. Use it when the folder is small enough to render fully and a basic list
meets the need.

```ts
import { createPlainTheme, defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  theme: createPlainTheme({
    project: { name: "Downloads", repositoryUrl: "https://example.com/downloads" },
  }),
});
```

`project` accepts the same metadata fields as the default theme. The plain
theme links its repository name only when `repositoryUrl` is supplied
explicitly. It shows modified times in UTC because it has no browser script.
The [plain example](../examples/) shows the resulting page.

## Default theme options

Pass the result of `createDefaultTheme()` as the config's `theme`:

```ts
import { createDefaultTheme, defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  theme: createDefaultTheme({
    globalSearch: false,
    virtualizeAfter: 1_000,
  }),
});
```

| Option               | Input and result                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colorScheme`        | Boolean; default `true`. Shows the appearance control. Set `false` to hide it; the page still follows the system color scheme.                           |
| `fuzzySearch`        | Boolean; default `true`. Enables current-folder fuzzy search. Set `false` to remove that search control.                                                 |
| `globalSearch`       | Boolean; default `true`. Shows Search all files. The browser loads its index after the visitor opens it and types. Set `false` for folder-only browsing. |
| `keyboardNavigation` | Boolean; default `true`. Enables explorer shortcuts. Set `false` when a custom page handles its own keys.                                                |
| `sorting`            | Boolean; default `true`. Shows runtime sort controls. Set `false` to keep the generated `sort` order without visitor controls.                           |
| `virtualizeAfter`    | Non-negative integer; default `500`. MPA directories above this size load rows from a data asset. Raise it to keep more rows in HTML.                    |
| `project`            | Metadata object; default bundled Dirwell metadata. Changes the footer's site name, author, and repository link.                                          |
| `icons`              | Light SVG set and optional dark set; default bundled icons. Replaces file-type artwork in normal, search, and virtual rows.                              |
| `components`         | Partial component object or array; default none. Replaces selected HTML parts; later layers win.                                                         |

The virtual list is available only in MPA mode when browser behavior is
enabled and the default `EntryList` and `EntryRow` components are in use.
SSG keeps complete list HTML. A custom row or list component keeps rendering
its own rows. Choose a higher `virtualizeAfter` only after checking page size
and browser behavior for your directory.

The default theme displays modified times in the visitor's local time zone
after JavaScript loads. Generated HTML labels the UTC time until then and
when JavaScript is disabled. Activate a date with pointer, touch, or keyboard to see its exact local offset
and UTC instant. Time sorting uses the stored instant.

### Project metadata

`project` accepts `name`, `repositoryUrl`, `author`, `authorUrl`, `license`,
and `licenseUrl` as strings. Omitted fields use the bundled Dirwell values.
Set the related URL when the displayed name should link to your own project.
Ledger's default footer shows `Dirwell · Ledger by VdustR`. With a custom site
name or author, it shows the site's name and author before the `Ledger` link.
The footer does not display `license` or `licenseUrl`; those fields remain
available to component overrides and the plain theme.

```ts
theme: createDefaultTheme({
  project: {
    name: "Downloads",
    repositoryUrl: "https://github.com/you/downloads",
    author: "Your name",
    authorUrl: "https://github.com/you",
    license: "MIT License",
    licenseUrl: "https://github.com/you/downloads/blob/main/LICENSE",
  },
}),
```

### File icons

`icons.light` requires `file` and `folder` SVG markup. Add
`byExtension: { pdf: pdfSvg, zip: zipSvg }` to match lowercase extensions
without a leading dot. Missing extensions use `file`. `icons.dark` has the
same shape; omit it to reuse the light icons in both schemes.

`icons.notice` is optional attribution text. When supplied, Dirwell publishes
it and links it from the default footer as **Icon licenses**. Include the license terms
required by your icon source. The [Catppuccin example configuration](https://github.com/vp-tw/dirwell/blob/main/examples/default-theme-override/dirwell.config.ts)
shows paired Latte and Macchiato sets. The bundled icon notices are in
[the Ledger README](https://github.com/vp-tw/dirwell/blob/main/src/theme-default/README.md).

### Component overrides

The default theme exposes `PageShell`, `Breadcrumbs`, `Toolbar`, `EntryList`,
`EntryRow`, `EmptyState`, `Footer`, and `Icon`. Each component receives typed
props and returns HTML. Replace one part when the existing explorer behavior
is still useful:

```ts
import {
  createDefaultTheme,
  defaultThemeComponents,
  defineConfig,
  escapeHtml,
} from "@vp-tw/dirwell";

export default defineConfig({
  theme: createDefaultTheme({
    components: {
      Footer: (props) =>
        `<p>${escapeHtml("Downloads & releases")}</p>${defaultThemeComponents.Footer(props)}`,
    },
  }),
});
```

Pass an array of component objects to layer shared and site-specific changes;
the last definition of a component wins. Call an exported default component
inside an override to keep its markup. Escape file names and other untrusted
text before inserting it into returned HTML.

Overriding `EntryList` or `EntryRow` disables the default MPA virtual list for
those pages. If the replacement must support large directories, implement
its own row loading or keep the default components.

## Crosswave

Crosswave uses a PSP-inspired crossbar with real file categories, a vertical
file list, and flowing ribbon light. It is an optional packaged renderer:

```ts
import { createCrosswaveTheme, defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  theme: createCrosswaveTheme({
    color: "azure",
    project: { name: "Media Library" },
  }),
});
```

| Option             | Default          | Effect                                                                                                                        |
| ------------------ | ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `color`            | `"azure"`        | Initial palette: `azure`, `violet`, `amber`, `rose`, `jade`, or `graphite`. Visitors can save another color.                  |
| `backgroundMotion` | `true`           | Enables animated light. Visitors can pause it; reduced motion and WebGL fallback keep a static background.                    |
| `pageTransitions`  | `true`           | Enables same-origin directory transitions in browsers with cross-document View Transitions. Other browsers navigate normally. |
| `gamepad`          | `true`           | Enables standard-mapped Gamepad API navigation where available. Keyboard and touch remain usable independently.               |
| `project`          | Dirwell metadata | Sets the displayed project name using the same metadata type as the other themes.                                             |

Use left/right to choose a category, up/down to select a file, Enter to open,
Backspace for the parent folder, and `/` for local search. Escape clears search.
The horizontal rail scrolls on narrow screens; long names wrap. All entries remain
HTML links in SSG and MPA, with no deferred list. Crosswave searches the current
folder and does not generate a global index. Use Ledger when global search or
large-directory virtualization is required.

A standard controller uses the D-pad or left stick for navigation, button 0 for
confirm, button 1 for back, and Start for search. Held confirm is ignored on
connection until released. Browser tests inject controllable Gamepad API data;
physical controllers, browser device activation, and USB/Bluetooth are unverified.
If a browser blocks a controller-initiated file tab, the focused link remains
available with an explicit Enter/click recovery message.

[Live Crosswave example](https://vp-tw.github.io/dirwell/examples/crosswave/) ·
[Source and research notes](https://github.com/vp-tw/dirwell/tree/main/examples/crosswave)

## Complete theme

Implement `ExplorerTheme` when the whole page layout or rendering system
needs to change. Give it a `name` and a `render(context)` function. Dirwell
passes prepared directory data, URL helpers, output mode, sort settings, and
safe navigation decisions. Return `{ html, assets? }`, where `html` is a full
document and `assets` maps filenames to text or bytes.

Set `searchIndex: false` if the theme has no global search. This avoids
generating an unused index. The [release catalog example](https://github.com/vp-tw/dirwell/tree/main/examples/custom-theme)
uses a complete renderer without client-side JavaScript. See the
[API reference](../api-reference/) for `ExplorerTheme` and `ThemeContext`.

## Localization belongs to the theme

Dirwell does not provide a core locale setting. Ledger, Plain, and Crosswave keep their
English interface. A renderer may own its dictionaries, language controls,
plural rules, and date/size formatting.

The [i18n example](https://github.com/vp-tw/dirwell/tree/main/examples/i18n)
provides English, Traditional Chinese, and Japanese switching. It updates
`html.lang`, accessible names, and the document title; stores the optional
preference across directories; and keeps an English listing with UTC dates
when JavaScript is unavailable. File names and link targets remain unchanged.

## Independent alpha packages

Use a peer dependency pinned to the Dirwell alpha that the theme has tested.
The [package contract](https://github.com/vp-tw/dirwell/blob/main/THEME_PACKAGE_CONTRACT.md)
describes rendering, navigation, assets, trust, and compatibility. The
[external package proof](https://github.com/vp-tw/dirwell/tree/main/examples/theme-package)
is packed and consumed separately from Dirwell by `pnpm verify:package`.
