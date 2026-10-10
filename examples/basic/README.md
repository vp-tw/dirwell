# Portable SSG example

Use this example when the published tree may move between paths. Its config
only sets the source and output directories. SSG and relative URLs keep their
defaults, so a nested file link resolves from the current page.

From the repository root after installing dependencies:

```bash
pnpm dirwell build files --cwd examples/basic -o dist
```

Open `examples/basic/dist/index.html` for this portable build. `pnpm examples:build` separately generates the Vite-owned published example under `docs/public/examples/basic/`. Keep CLI output in its own directory. See [all example workflows](https://vp-tw.github.io/dirwell/examples/).

- [Live demo](https://vp-tw.github.io/dirwell/examples/basic/)
- [Source code on GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/basic)
