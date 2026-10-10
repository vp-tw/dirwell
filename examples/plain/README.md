# Plain theme example

This example generates plain HTML listings with browser-native links and no icons,
JavaScript, search index, or color-scheme controls. Both SSG and MPA output contain
the complete listing; the theme does not use MPA virtualization.
Use it when the source folders are small enough to render fully and visitors
do not need client-side search or appearance controls.

From the repository root after installing dependencies:

```bash
pnpm dirwell build files --cwd examples/plain -o dist
```

Open `examples/plain/dist/index.html` for this portable build. `pnpm examples:build` separately generates the Vite-owned published example under `docs/public/examples/plain/`. Keep CLI output in its own directory. See [all example workflows](https://vp-tw.github.io/dirwell/examples/).

- [Live demo](https://vp-tw.github.io/dirwell/examples/plain/)
- [Source code on GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/plain)
