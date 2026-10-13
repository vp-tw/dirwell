---
title: Configuration
description: Configure themes, file selection, static builds and live server behavior.
---

The CLI reads `dirwell.config.mjs` in the working directory, or the native JavaScript module selected by `--config`. It expects a resolved default object with `theme`, `listing`, `build` and `server` keys. Use top-level await for asynchronous setup.

```js
import { createLedgerTheme } from "@dirwell/theme-ledger";

export default {
  theme: createLedgerTheme({ title: "Downloads" }),
  build: { exclude: ["drafts/**"], mode: "ssg", urlStrategy: "relative" },
  server: { exclude: ["drafts/**"], port: 3000, live: { intervalMs: 1000 } },
};
```

Install the imported theme in the working project. Run `npx dirwell build ./files --out ./generated` or `npx dirwell server ./files`. Source and build output remain explicit command arguments. Put selection rules in both sections if both modes should use them.

## Build settings

`build` accepts [GenerateOptions](../api-reference/) except `sourceDir`, `outputDir`, `theme` and `listing`. Set `include`, `exclude`, `mode`, `base`, `urlStrategy`, `mirror`, `outputName`, `sort`, `symlinks` and optional `metadata`. Default mode is `ssg`, links are relative, and selected files are mirrored.

`outputName` can be a filename or an async per-directory callback returning a filename or `null` to omit an explorer page. The dedicated output tree is replaced after a successful build. `mirror: false` avoids copying source files; supply a URL layout that reaches files hosted elsewhere.

## Server settings

`server` accepts Node server options except `root`, `theme` and `listing`. Configure `host`, `port`, `mountPath`, selection, sorting, headers, authorization, file transport and `live`. Standalone defaults bind loopback and use safe media previews. Integrated handlers disable file transport unless configured.

Authorization runs before conditional responses and byte transfer. It controls requests, not individual child-name redaction. Allowing a directory listing exposes its selected child names. See [server behavior](../sdk-alpha/#headers-authorization-and-freshness).

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
