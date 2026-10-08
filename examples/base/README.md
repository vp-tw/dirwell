# Base URL example

Use this example for a known project-site path. MPA shares runtime assets in
`__dirwell/`; `urls: "base"` prefixes generated links with the published mount.
Set `DIRWELL_SITE_BASE` to the site's base path before building.

```bash
DIRWELL_SITE_BASE=/dirwell/ node ../../src/bin.ts build files --cwd .
```

Run it from this directory. It writes `docs/public/examples/base/`; its asset
links point to `/dirwell/examples/base/`. Change the environment value if the
site is published under another path. The Pages build loads this same config
through the Vite adapter.

- [Live demo](https://vp-tw.github.io/dirwell/examples/base/)
- [Source code on GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/base)
