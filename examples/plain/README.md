# Plain theme example

This example generates plain HTML listings with browser-native links and no icons,
JavaScript, search index, or color-scheme controls. Both SSG and MPA output contain
the complete listing; the theme does not use MPA virtualization.
Use it when the source folders are small enough to render fully and visitors
do not need client-side search or appearance controls.

```bash
node ../../src/bin.ts build files --cwd .
```

Run it from this directory. It writes `docs/public/examples/plain/`. The
Pages build loads this config through the Vite adapter.

- [Live demo](https://vp-tw.github.io/dirwell/examples/plain/)
- [Source code on GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/plain)
