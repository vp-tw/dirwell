---
title: Deployment
description: Publish complete static output with a URL strategy that matches its host.
---

Build a dedicated output tree and publish every file inside it:

```sh
npx @dirwell/cli build ./downloads --out ./site-downloads
```

A static host serves the generated HTML, listing data, theme assets and mirrored source files. No Dirwell server is needed. Rebuild when the source changes. Do not overlay only selected HTML files; their asset/data references belong to the same build.

## URL strategies

| Strategy    | Behavior                                                |
| ----------- | ------------------------------------------------------- |
| `relative`  | Portable links relative to each generated page; default |
| `base`      | Links rooted under an explicit deployment prefix        |
| `html-base` | HTML base element with links resolved under that prefix |

For a fixed GitHub Pages or CDN prefix:

```sh
npx @dirwell/cli build ./downloads --out ./dist --base /project/downloads/ --urls base
```

The prefix must match the deployed explorer root. `ssg` and `mpa` describe output layout, independently of link strategy. Both generate HTML; rich clients fetch data and assets over HTTP. Serve directory indexes and check a child page directly, not just the root.

## Choose the interface

Plain is included and emits no browser JavaScript by default. Install a rich theme explicitly for directory search and sorting. Use `--page-size 100` for native pagination. Core/integrations require an explicit theme; the CLI selects Plain when omitted.

## Existing source pages

Source `index.html` and `index.htm` are preserved. The default output-name resolver uses `_dirwell.html` when the preferred index is occupied. Override `build.outputName` only when that layout is deliberate. Do not use a build output directory for unrelated files: builds replace it.

## Live hosting

Use [server mode](../sdk/#standalone-and-integrated-http) when data must update on requests. A Node host owns authentication, mounting and shutdown. Standalone defaults preview media and download active formats. Static hosting and live file transport have different execution and access-control boundaries.
