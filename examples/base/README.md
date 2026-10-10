# Base URL example

Use this example for a known project-site path. MPA shares runtime assets in
`__dirwell/`; `urls: "base"` prefixes generated links with the published mount.
Set `DIRWELL_SITE_BASE` to the site's base path before building.

From the repository root after installing dependencies:

```bash
pnpm dirwell serve files --cwd examples/base -o dist
```

Open the printed `Local:` URL, which includes the configured `/examples/base/` mount. Stop with Ctrl+C. To build once, use `pnpm dirwell build files --cwd examples/base -o dist`; serve that output beneath its configured HTTP prefix, rather than opening it as a local file. `pnpm examples:build` separately generates the Vite-owned published example. See [example workflows](https://vp-tw.github.io/dirwell/examples/).

- [Live demo](https://vp-tw.github.io/dirwell/examples/base/)
- [Source code on GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/base)
