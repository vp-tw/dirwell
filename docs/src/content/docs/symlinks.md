---
title: Symlinks
description: Decide whether directory links are listed, followed, or rejected.
---

Dirwell always lists a selected symlink and shows its declared target.
Following directory symlinks is optional.

```ts
export default defineConfig({
  symlinks: {
    follow: true,
    boundary: "root",
    onCycle: "skip",
  },
});
```

| Setting    | Input and result                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `follow`   | Boolean; default `false`. Set `true` to generate pages through eligible directory links, such as internal aliases.                                              |
| `boundary` | `"root"` or `"anywhere"`; default `"root"`. Root keeps traversal in the source tree. Anywhere relaxes that boundary; review the source and output policy first. |
| `onCycle`  | `"skip"` or `"error"`; default `"skip"`. Skip stops recursion at an ancestor cycle. Error fails the build so you can fix the link.                              |

`follow: false` still shows a symlink entry. It does not make an outside or
broken target available.

## What visitors see

| Link state                               | Page behavior                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Internal file or directory target        | Links to the target when it is available in the generated output.                                                                                |
| Broken target                            | Shows a broken-link state. Opening it displays the raw `readlink()` target text as plain text in a new tab.                                      |
| Target outside the source root           | Shows an unavailable state and no resolved absolute machine path in HTML.                                                                        |
| Ancestor cycle                           | Shows a cycle state. With `skip`, generation stops at the cycle instead of recursing forever; the entry can link to an already generated target. |
| Target removed by `include` or `exclude` | The symlink can stay listed but has no usable target link. It is not mirrored.                                                                   |

Dirwell mirrors source files by default. It copies only relative symlinks
whose target remains inside the selected output tree. The CLI omits absolute
and escaping symlinks from the mirrored tree. The Vite adapter rejects an
included absolute or escaping symlink when mirroring is enabled, because it
could expose files outside its output. Exclude the link or set `mirror: false`
when another publisher controls the source files and Dirwell should
generate pages only.

Use `onCycle: "error"` for a build that should fail on accidental loops.
Use `skip` for a browsable tree with intentional internal aliases. Test the
published output after changing `boundary`, `follow`, or `mirror`; these
settings affect which links can be followed and which files are present.
