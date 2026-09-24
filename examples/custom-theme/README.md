# Build a release catalog

This example supplies its own HTML and CSS through a complete Dirwell theme. It
uses the prepared directory data and link decisions, so it does not need to
reimplement file scanning or safe navigation. The release files are synthetic.
The listing intentionally has no client-side search or JavaScript. Use this
pattern when the whole page should look unlike the default explorer; use
component overrides when only a few parts need to change.

```bash
node ../../src/bin.ts build files --cwd .
```

Run it from this directory. It writes `docs/public/examples/custom-theme/`.
The Pages build uses this config through the Vite adapter.

- [Live demo](https://vp-tw.github.io/dirwell/examples/custom-theme/)
- [Source code on GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/custom-theme)
