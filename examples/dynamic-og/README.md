# Per-folder share images

The optional share-image provider generates a PNG for each folder before deployment. Canonical and OG URLs include the deployment prefix.

From an installed repository checkout:

```sh
node scripts/build-example.ts dynamic-og ./generated-dynamic-og
```

`config.ts` exports core `GenerateOptions`; it is consumed by this SDK build script, not discovered by CLI. For a standalone CLI project, use `dirwell.config.mjs` with `{ theme, build, server, listing }`. Build replaces its dedicated output tree. Serve the complete result over HTTP. `SITE_BASE=/dirwell/ pnpm site:build` publishes every example for the documentation site.
