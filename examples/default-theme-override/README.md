# Customize the default theme

This example keeps Dirwell's default explorer and changes its color palette,
file icons, and header. Light uses Catppuccin Latte; dark uses Macchiato. The
Latte link accent is darkened to stay legible on hover backgrounds. The system
setting follows the operating system. Directory rows, global search, and
virtualized rows use the same icon set.

```bash
node ../../src/bin.ts build --cwd .
```

The example copies selected [Catppuccin VS Code icons](https://github.com/catppuccin/vscode-icons)
from revision `b6915da9f6889b683a110aa747de96c2820a537d` under the MIT
license in [`icons/LICENSE`](icons/LICENSE). Colors follow
[Catppuccin Palette](https://github.com/catppuccin/palette) revision
`07d02aa110ef9eb7e7427afca5c73ba9cf7f8ebd`.

- [Live demo](https://vp-tw.github.io/dirwell/examples/default-theme-override/)
- [Source code on GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/default-theme-override)
