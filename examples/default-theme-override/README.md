# Customize the default theme

This example keeps Dirwell's default explorer and changes its color palette,
file icons, and header. Light uses Catppuccin Latte; dark uses Macchiato. The
Latte link accent is darkened to stay legible on hover backgrounds. The system
setting follows the operating system. Directory rows, global search, and
virtualized rows use the same icon set.

Use this pattern when the default explorer's search and navigation should
remain, but the visual theme needs its own palette, icons, or components.
`createDefaultTheme({ icons, components })` changes only those parts; a
complete renderer would own the whole document.

From the repository root after installing dependencies:

```bash
pnpm dirwell build files --cwd examples/default-theme-override -o dist
```

Open `examples/default-theme-override/dist/index.html` for this portable build. `pnpm examples:build` separately generates the Vite-owned published example under `docs/public/examples/default-theme-override/`. Keep CLI output in its own directory. See [all example workflows](https://vp-tw.github.io/dirwell/examples/).

- [Live demo](https://vp-tw.github.io/dirwell/examples/default-theme-override/)
- [Source code on GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/default-theme-override)

The custom icons are selected from [Catppuccin VS Code icons](https://github.com/catppuccin/vscode-icons) revision `b6915da9f6889b683a110aa747de96c2820a537d`, under MIT in [`icons/LICENSE`](icons/LICENSE). Colors follow [Catppuccin Palette](https://github.com/catppuccin/palette) revision `07d02aa110ef9eb7e7427afca5c73ba9cf7f8ebd`.

The Toolbar override wraps `defaultThemeComponents.Toolbar(props)`, preserving its native controls and runtime hooks. See the [Ledger runtime contract](../../THEME_RUNTIME_CONTRACT.md). Wrapping `EntryRow` or `EntryList` additionally disables automatic virtualization; keeping those functions unchanged preserves large-folder behavior.
