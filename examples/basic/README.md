# Portable SSG example

Use this example when the published tree may move between paths. Its config
only sets the source and output directories. SSG and relative URLs keep their
defaults, so a nested file link resolves from the current page.

```bash
node ../../src/bin.ts build files --cwd .
```

Run the command from this example directory. It writes
`docs/public/examples/basic/` in this repository. The Pages build uses the
same config through the Vite adapter.

- [Live demo](https://vp-tw.github.io/dirwell/examples/basic/)
- [Source code on GitHub](https://github.com/vp-tw/dirwell/tree/main/examples/basic)
