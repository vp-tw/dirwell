# Build a release catalog

This example supplies its own HTML and CSS through a complete Dirwell theme. It
uses the prepared directory data and link decisions, so it does not need to
reimplement file scanning or safe navigation. The release files are synthetic.
The listing intentionally has no client-side search or JavaScript. Use this
pattern when the whole page should look unlike the default explorer; use
component overrides when only a few parts need to change.

From the repository root after installing dependencies:

```bash
pnpm dirwell build files --cwd examples/custom-theme -o dist
```

Open `examples/custom-theme/dist/index.html` for this portable build. `pnpm examples:build` separately generates the Vite-owned published example under `docs/public/examples/custom-theme/`. Keep CLI output in its own directory. See [all example workflows](https://vp-tw.github.io/dirwell/examples/).

- [Live demo](https://vp-tw.github.io/dirwell/examples/custom-theme/)
- [Source code on GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/custom-theme)
