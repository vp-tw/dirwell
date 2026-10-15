---
title: Configuration
description: Configure themes, file selection, static builds and live server behavior.
---

The CLI reads `dirwell.config.mjs` in the working directory, or the native JavaScript module selected by `--config`. It expects a resolved default object with `theme`, `routing`, `listing`, `build` and `server` keys. Use top-level await for asynchronous setup.

```js
import { createLedgerTheme } from "@dirwell/theme-ledger";

export default {
  theme: createLedgerTheme({ title: "Downloads" }),
  build: { exclude: ["drafts/**"], mode: "ssg", urlStrategy: "relative" },
  server: { exclude: ["drafts/**"], port: 3000, live: { intervalMs: 1000 } },
};
```

Install the imported theme in the working project. Run `npx dirwell build ./files --out ./generated` or `npx dirwell server ./files`. Source and build output remain explicit command arguments. Put selection rules in both sections if both modes should use them.

## Shared routing

Set `routing: { directoryUrls: "explicit" }` at the top level. It applies to every
theme in build and server modes; `explicit` is the default. `slash` needs directory
index serving; `clean` needs extensionless routing and changes static output
placement. Null and invalid policies fail, rather than selecting a fallback.
`--directory-urls` overrides the shared config value. Keep static `urlStrategy`
and `base` inside `build`, and live `mountPath` inside `server`.
See [directory URLs](../urls/) for output trees, conflicts and migration.

## Build settings

`build` accepts [GenerateOptions](../api-reference/) except `sourceDir`, `outputDir`, `theme`, `routing` and `listing`. Set `include`, `exclude`, `mode`, `base`, `urlStrategy`, `mirror`, `outputName`, `sort`, `symlinks` and optional `metadata`. Default mode is `ssg`, links are relative, and selected files are mirrored.

`outputName` can be a filename or an async per-directory callback returning a filename or `null` to omit an explorer page. The dedicated output tree is replaced after a successful build. `mirror: false` avoids copying source files; supply a URL layout that reaches files hosted elsewhere.

## Server settings

`server` accepts Node server options except `root`, `theme`, `routing` and `listing`. Configure `host`, `port`, `mountPath`, selection, sorting, headers, authorization, file transport and `live`. Standalone defaults bind loopback and use safe media previews. Integrated handlers disable file transport unless configured.

Authorization runs before conditional responses and byte transfer. It controls requests, not individual child-name redaction. Allowing a directory listing exposes its selected child names. See [server behavior](../sdk/#headers-authorization-and-freshness).

## Listing policy

```js
export default {
  listing: ({ visibleCount }) => ({
    html: visibleCount > 500 ? { strategy: "paged", pageSize: 100 } : { strategy: "all" },
    data: { strategy: "all" },
  }),
};
```

HTML pagination and public data publication are independent. The synchronous callback runs per directory and receives path, entry count, UTF-8 data size, operation and pagination capability. Use `data: { strategy: "blocks", blockSize: 200 }` when splitting responses helps. Rich themes need complete coherent data for directory-wide filtering; splitting does not bound their total data needs.

CLI flags override the corresponding configuration settings. Build adapters take explicit host options and do not discover this file. No config loader, inheritance or implicit TypeScript compilation is included in the CLI.

## Live archive search

Enable `server: { search: {} }` to add fresh cross-directory filename/path queries. It is off by default. Ledger and Crosswave distinguish the archive dialog from their current-directory filter; either factory accepts `archiveSearch: false` to hide the dialog. Plain keeps native browsing.

The endpoint is `GET /__dirwell/search?q=report&path=docs&limit=25`, under your configured mount. Defaults bound scans to 10,000 entries/1,000 directories, two active queries, 100 results and five seconds. Set `maxEntries`, `maxDirectories`, `maxConcurrent`, `maxResults`, `timeoutMs` and `refreshIntervalMs` inside `search`. The open rich dialog debounces typing by 300 ms and refreshes every two seconds while visible. No background archive scan runs with the dialog closed.

Queries apply selection rules and per-path authorization before child traversal, omit symbolic-link aliases and private annotations, and return encoded native links. Root/ancestor access is required for subtree queries. Scan exhaustion returns 503, overload returns 429 and result truncation is explicit. Every request scans fresh; there is no file-content index, transactional snapshot or distributed cache. Qualify your own tree and host callbacks before raising the limits.
