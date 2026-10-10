# Ledger component runtime contract

Use `createDefaultTheme({ components })` to keep Ledger behavior while replacing its HTML. Prefer wrapping `defaultThemeComponents` and passing every prop through, as the [complete override example](examples/default-theme-override/dirwell.config.ts) does. A type-correct component can still break behavior if it removes the runtime's hooks.

This contract applies only to Ledger component overrides. Independent `ExplorerTheme` renderers own their runtime and do not need Ledger's markup. Crosswave's internal hooks are not a generic theme API. Verify the documented hooks against the Dirwell versions declared by your theme package.

## Keep the shell and output lifecycle

`PageShell` must return a complete document, preserve `documentBaseHref`, render `metadata?.head` when supplied, and include `assets` after its explorer markup. Assets contain the runtime and the appearance initialization script. Render each supplied fragment once rather than duplicating its controls or identifiers.

| Hook                                         | Contract and purpose                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[data-explorer]`                            | One explorer root per generated document. The runtime reads its `data-config` JSON from `runtimeConfig`. Escape JSON for a double-quoted HTML attribute. |
| `data-parent-href` on the root               | Include `parentHref` when non-null. Backspace uses it; the root has no destination.                                                                      |
| `[data-entry-list]`                          | The `ul` that owns rows. Filtering hides rows and sorting appends matching rows here.                                                                    |
| `[data-visible-count]`, `[data-count-label]` | Visible-entry number and singular/plural label. Parent navigation is excluded.                                                                           |
| `[data-empty]`                               | Initially hidden empty-result text. Runtime owns its visibility and message.                                                                             |
| `[data-live-status]`                         | Text status with `aria-live="polite"`; announces filtering and loading results.                                                                          |
| `[data-folder-loading]`                      | Keep when `runtimeConfig.entriesHref` exists. The initial large-list loading state must also have a meaningful no-script fallback.                       |

Preserve `html[data-theme]` and the color-scheme declaration when keeping Ledger appearance. Existing layout selectors such as `header`, `.entry-head`, and `.sort-heading:last-child` also support sticky measurements and the modified-time zone label. Those are Ledger layout details; arbitrary class names are not covered by a generic theme API.

## Rows and native navigation

Each normal row has `[data-entry]` and the following attributes. Use prepared props and escape names and targets. Directory-like symlinks use the target's kind for grouping, but still count as links for type filters.

| Attribute        | Value                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `data-order`     | Original numeric `index`, used for deterministic tie-breaking.                                                           |
| `data-name`      | Original entry name.                                                                                                     |
| `data-search`    | Lowercase name plus declared symlink target for fuzzy matching.                                                          |
| `data-size`      | Source entry size, or zero for a physical directory. A symlink uses its own size.                                        |
| `data-modified`  | Modified instant in epoch milliseconds; zero when unavailable.                                                           |
| `data-directory` | `"true"` for a directory or directory-target symlink, otherwise `"false"`.                                               |
| `data-link`      | `"true"` for a symlink, otherwise `"false"`.                                                                             |
| `data-kind`      | `directory`, `file`, or `link`, using the same rule as the default row. `data-link` takes precedence for type filtering. |

Keep one primary native anchor in each usable row, with `navigation.href` and `target="_blank" rel="noopener"` when `navigation.exitsExplorer` is true. A null href renders unavailable text. Arrow navigation focuses the first anchor of each visible normal row; extra decorative links before it would change the destination. The runtime may mark the active row with `data-active`.

The separate parent row has `[data-parent]` and no `[data-entry]`. It stays outside counts, filtering, sorting, and Arrow-key file navigation. Backspace is the keyboard parent action. `time[datetime]` opts a timestamp into Ledger's local-time presentation and exact-time dialog; use the UTC source instant, not a localized string.

Replacing `EntryRow` or `EntryList` disables Ledger's automatic MPA virtualization, including when the override wraps the defaults. Complete rows are rendered in HTML instead. Keep both default functions unchanged for the built-in large-list path. Internal `data-virtual-index` and worker protocols are not an override API.

## Toolbar and enabled features

Disable a feature through theme options when its controls are intentionally absent. Preserve native labels, buttons, inputs, selects and fieldsets, not only data attributes.

| Feature         | Required controls when retained                                                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local search    | `input[type=search][data-search-input]`; `/` focuses it and Escape clears it. Composition events defer filtering until input is committed.                                                                                                                                              |
| Type filtering  | `[data-type-filters]` with checked checkbox inputs `[data-type-filter]`, values `directory`, `file`, `link`. Without the group, all types remain included.                                                                                                                              |
| Sorting         | Selects `[data-sort-field]` (`name`, `size`, `modified`), `[data-name-mode]` (`natural`, `locale`, `unicode`), `[data-sort-direction]` (`asc`, `desc`); checkbox `[data-directories-first]`. `[data-name-mode-control]` is the wrapper hidden outside name sorting.                     |
| Heading sorting | Buttons `[data-sort-heading]` with `name`, `size`, `modified`. The runtime updates labels and `aria-pressed`. Retain `.sort-indicator` when keeping Ledger's direction icon.                                                                                                            |
| Appearance      | Select `[data-color-scheme]`, values `system`, `light`, `dark`. Preferences update `html[data-theme]`.                                                                                                                                                                                  |
| Global search   | `[data-global-open]` button and one native `dialog[data-global-dialog]` containing `[data-global-input]`, `[data-global-results]`, `[data-global-status]`, `[data-global-close]`. Keep its label/heading association. An optional type-filter group follows the same checkbox contract. |
| Keyboard help   | If the input uses `aria-describedby="keyboard-shortcuts"`, keep that uniquely identified help element, or update the association.                                                                                                                                                       |

Global search belongs outside the explorer root in the default PageShell, and its rows are created by the runtime, not by an overridden `EntryRow`. Keeping Ledger's icon configuration also keeps generated global/virtual rows consistent with static rows.

## Verify an override

Run `pnpm test:compat` for the bounded Chromium/Firefox/WebKit suite, and `pnpm test:browser` for full Chromium regression. The contract test wraps Toolbar and EntryRow in both SSG and MPA, then exercises local/global search, sorting, appearance, keyboard file/parent navigation, folder links, complete HTML above the virtualization threshold, narrow reflow, and page errors.

The cross-engine suite also checks Crosswave folder/history navigation and Plain native navigation with JavaScript disabled. Playwright WebKit is not a physical Safari or iOS test. See [Playwright's browser distinction](https://playwright.dev/docs/browsers#webkit).
