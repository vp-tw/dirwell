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

## A share image cannot be generated

Built-in PNG rendering uses bundled Source fonts and reports unsupported characters instead of using system-font fallback. For text outside their repertoire, provide `metadata.image` as an existing image or custom renderer; `image: false` disables the image while keeping page text metadata.

Local image paths resolve from the config/project directory. Explicit `outputPath` values are relative to generated output and must not overlap source entries, page names, or reserved assets. Use a separate `og/` directory. A failed image callback leaves the previous output intact. See [image sources and paths](../metadata/#fixed-text-and-an-existing-image).

## The Vite adapter refuses an existing output directory

The adapter requires its ownership marker before replacing an existing tree. A CLI build into `docs/public/examples/` removes that marker. Build standalone examples to their own `dist/`, or use `pnpm examples:build` for the site output. Do not delete an unknown directory to bypass this check; preserve its contents and choose a dedicated output. See [example workflows](../examples/#run-one-example).

For a problem outside these cases, include a small reproduction in an
[issue](https://github.com/vp-tw/dirwell/issues). See the [support policy](../support/).
