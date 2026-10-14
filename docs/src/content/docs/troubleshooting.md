---
title: Troubleshooting
description: Resolve CLI setup, config, data and deployment problems.
---

## First command fails

Use Node.js 22.12 or later and an existing source directory:

```sh
npx @dirwell/cli server ./downloads
```

A file path is not a directory. Build requires `--out`. Server-only flags fail in build mode and build-only flags fail in server mode. Start with `--help`.

## Theme package not found

Plain is included. Other themes must be installed in the working project or supplied through npm exec alongside CLI. Explicit theme errors do not fall back to Plain. A config import needs the package installed in the project containing that config.

## Configuration does not load

Use `dirwell.config.mjs`, or `--config` with a native JavaScript module. The default export must be a resolved object with `theme`, `listing`, `build`, `server`. Put excludes inside build/server, not at the top level. Existing unsupported config filenames trigger a migration error instead of being ignored. Two packages providing the `dirwell` executable should not be installed in the same project.

## Files do not update

Static output requires a rebuild. Server reads data on requests; Plain needs refresh/navigation. Rich clients need `--live` or `server.live` for automatic updates. A custom browser cache policy may skip requests; default responses use no-store. Source edits require a new compiled theme instance or the authoring development server.

## Search scope is unexpected

Rich themes filter complete directory data. Ledger archive search is available in static output; live server mode has no archive index. Plain has no search runtime. HTML pagination, data blocks and row virtualization are separate choices.

## Nested pages or assets fail

Publish the entire output tree and match `--base` to its deployed root when using rooted URLs. Serve directory indexes over HTTP. Source index pages may cause an explorer to use `_dirwell.html`. Do not assume opening a rich page through `file://` qualifies its fetch-based client.

## Files download instead of previewing

Standalone safe-media mode previews supported images/audio/video and downloads HTML, SVG and other active formats. Integrated handlers disable file transport by default; the host must opt in or delegate file links. Outside, broken and excluded targets remain unavailable.
