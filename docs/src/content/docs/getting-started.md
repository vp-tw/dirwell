---
title: Getting started
description: Open a folder or build a static explorer with the lightweight CLI.
---

With Node.js 22.12 or later and an existing folder:

```sh
npx @dirwell/cli@alpha server ./downloads
```

Open the printed URL. The server binds to loopback on an available port. Refreshing or navigating reads current files. Ctrl+C stops the server. No project, configuration or separate theme install is required.

## Publish a static folder

```sh
npx @dirwell/cli@alpha build ./downloads --out ./site-downloads
```

Upload the entire output tree to a static host. Build replaces this dedicated directory; keep unrelated files elsewhere. Selected source files are copied by default. Existing source `index.html` and `index.htm` files are preserved; the explorer uses `_dirwell.html` when available.

Plain is the default and has no search runtime, fonts, icons or generated share image. For a searchable interface:

```sh
npm install --save-dev @dirwell/cli@alpha @dirwell/theme-ledger@alpha
npx dirwell server ./downloads --theme ledger --live
```

`--live` refreshes rich-client data automatically. Ledger and Crosswave are separate optional installs. [Configuration](../configuration/) explains custom themes, file selection and build settings. [Deployment](../deployment/) explains URL prefixes and HTTP hosting.
