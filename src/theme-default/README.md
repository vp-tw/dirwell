# Ledger

Ledger is Dirwell's default file explorer theme. It presents published files in
a compact table with search, sorting, file type filters, and light and dark color
schemes. The footer links here so visitors can identify the theme and find its
icon attribution.

Use `createDefaultTheme()` to configure Ledger. You can replace its components,
provide your own icons, or set `project` metadata for the published site. See
the [theme guide](../../THEMING.md) for the API and examples.

## Licenses and icon attribution

Dirwell's source code, including the Ledger implementation, is distributed
under the [MIT License](../../LICENSE).

Ledger's built-in file and folder icons are selected, unmodified artwork from
the [vscode-icons contributors](https://github.com/vscode-icons/vscode-icons/tree/6b4471cf8dcdeafc9d1203f9156d285fc3e9d552/icons).
They are distributed under [Creative Commons Attribution-ShareAlike 4.0
International](https://creativecommons.org/licenses/by-sa/4.0/). Branded icons
may also be subject to their respective owners' rights. Neither those owners
nor vscode-icons endorse Dirwell.

The [built-in icon notice](../vscode-icons/NOTICE.txt) lists every included
source filename and records its source, authors, license, and modification
status. Generated sites also include that notice as
`vscode-icons-NOTICE.txt`.

If you supply custom icons, their licensing depends on the artwork you choose.
Set `icons.notice` to publish attribution with the generated site. Ledger then
shows a separate **Icon licenses** link to that local notice.
