---
title: Getting started
description: Browse a folder locally, then build files for a static host.
---

These commands run from a Dirwell repository checkout. Install its
dependencies once with `pnpm install`. The packaged CLI uses the same
`dirwell` commands after installation.

## 1. Browse a folder

```bash
pnpm dirwell serve ./fixture
```

Open the `Local:` URL printed by the command. Dirwell watches `./fixture`,
rebuilds after a change, and reloads connected browsers. Omit `serve` for the
same foreground workflow. The source directory defaults to `.`, so pass it
explicitly when you mean a different folder.

## 2. Build a publishable tree

```bash
pnpm dirwell build ./fixture -o ./generated
```

`build` writes static files and exits. Deploy the complete `generated/`
directory. With no options, Dirwell uses SSG and links relative to each page,
so the output can move to another path as one tree. The build replaces the
generated output directory; keep unrelated files elsewhere.

If a source directory has `index.html` or `index.htm`, Dirwell keeps it and
writes the explorer as `_dirwell.html`. If that name also exists, it skips the
explorer page for that directory.

## 3. Change one setting at a time

| Need                                              | Change                                |
| ------------------------------------------------- | ------------------------------------- |
| A known public path such as `/project/downloads/` | Set `base` and `urls: "base"`.        |
| One shared asset directory across many pages      | Set `mode: "mpa"`.                    |
| A subset of the source tree                       | Set `include` and `exclude` globs.    |
| Different controls or icons                       | Set `theme: createDefaultTheme(...)`. |
| A no-script listing                               | Set `theme: createPlainTheme()`.      |

Use `dirwell.config.ts` for settings that do not have CLI flags:

```ts
import { defineConfig } from "dirwell";

export default defineConfig({
  include: ["**/*.md", "assets/**"],
  exclude: ["drafts/**"],
});
```

Run `pnpm dirwell build ./fixture -o ./generated` again. The CLI positional
directory has a `.` default and overrides config `root`, so keep the source
path in the command. The [configuration guide](../configuration/) lists every
field, accepted value, default, and effect.
