# Legacy download archive

This earlier Ledger archive is retained for existing links. Use the
[Ledger example](../file-icons/) to compare the default theme with Plain and Crosswave.

The config uses a sample download-library name and archive-specific link previews.
SSG and relative URLs keep the output portable between deployment paths.

From the repository root after installing dependencies:

```bash
pnpm dirwell build files --cwd examples/basic -o dist
```

Open `examples/basic/dist/index.html` for this portable build. `pnpm examples:build` separately generates the Vite-owned published example under `docs/public/examples/basic/`. Keep CLI output in its own directory. See [all example workflows](https://vp-tw.github.io/dirwell/examples/).

- [Live demo](https://vp-tw.github.io/dirwell/examples/basic/)
- [Source code on GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/basic)
