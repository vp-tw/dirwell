# Your own Crosswave categories

A complete Crosswave example with a renamed/reordered rail, a trusted original
SVG code glyph, source and archive filters, and overlapping categories. The
source-code rule uses explicit extensions; the same `.js` file also belongs to
Documents through its inferred `text/javascript` MIME type.

`categories` replaces the rail. IDs drive keyboard/gamepad selection and history;
labels are escaped text. Rules run during Node generation. The browser receives
membership IDs and ordinary HTML links, without the MIME database. MIME lookup
estimates from names; it does not inspect bytes. `.ts` is ambiguous in MIME data,
so Source code explicitly matches it. An empty ZIP, original SVG, tiny code files,
and an unknown-type text specimen exercise the filters without autoplay.

Run `pnpm examples:build` to build the Vite-owned published tree. For a separate
CLI build, run this from the repository root:

```sh
pnpm dirwell build files --cwd examples/crosswave-categories -o ../../generated/crosswave-categories
```

[Theme guide](https://vp-tw.github.io/dirwell/themes/#custom-categories) ·
[Live example](https://vp-tw.github.io/dirwell/examples/crosswave-categories/)
