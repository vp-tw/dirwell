---
title: Troubleshooting
description: Resolve common installation, generated-output, and deployment problems.
---

## The command does not start

Run `node --version`; Dirwell requires Node.js 26 or later. Use the scoped package
name and alpha tag:

```bash
npx @vp-tw/dirwell@alpha serve ./downloads
```

If the source is not found, check that `./downloads` exists relative to your
current working directory. For an occupied port, add `--port 0` and open the
new `Local:` URL. Stop the foreground server with Ctrl+C.

## A config import cannot find Dirwell

An `npx` run does not add Dirwell to your project's dependencies. Before creating
a config that imports `@vp-tw/dirwell`, install it in that project:

```bash
npm install --save-dev @vp-tw/dirwell@alpha
```

Run the command from the directory containing the config, or pass `--cwd`.
Keep the source path explicit: the CLI's default `.` overrides config `root`.
See [configuration precedence](../configuration/#where-settings-come-from).

## The generated page is my existing index

Dirwell preserves source `index.html` and `index.htm`. Look for `_dirwell.html`
in that output directory. If this fallback name was already present, Dirwell
skipped its listing there. See [output naming](../configuration/#input-and-output).

## The root opens, but nested links or assets fail

Publish the complete output tree, including `__dirwell/` when present. For
`urls: "base"`, the configured `base` must match the path where you publish the
output. Changing `base` does not create a matching filesystem directory.
Test through a static HTTP server; opening an MPA page as `file://` can block
its data requests. See [deployment](../deployment/).

## A large directory has no rows without JavaScript

Ledger can defer MPA lists above 500 entries into a data asset. Choose the default
SSG mode or [Plain](../themes/#plain-theme) when a complete no-script listing is
required. Raising `virtualizeAfter` keeps more HTML rows but also increases page
size. Replacing the list or row component disables Ledger's default virtualization.

## Files do not update in a build-tool watch session

Check the [verified host behavior](../build-tools/#development-and-verification).
Farm's native standalone watch does not refresh Dirwell source files. Use its
verified development-server integration, run builds explicitly, or use the
standalone Dirwell CLI for folder browsing. These are separate workflows; the
CLI does not rebuild the rest of a Farm application.

For a problem outside these cases, include a small reproduction in an
[issue](https://github.com/vp-tw/dirwell/issues). See the [support policy](../support/).
