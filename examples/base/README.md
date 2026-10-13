# Deploy under a URL prefix

This example uses MPA and rooted links under `/examples/base/`. Serve it at the matching mount; do not open it from an arbitrary file URL.

From an installed repository checkout:

```sh
node scripts/build-example.ts base ./generated-base
```

`config.ts` exports core `GenerateOptions`; it is consumed by this SDK build script, not discovered by CLI. For a standalone CLI project, use `dirwell.config.mjs` with `{ theme, build, server, listing }`. Build replaces its dedicated output tree. Serve the complete result over HTTP. `SITE_BASE=/dirwell/ pnpm site:build` publishes every example for the documentation site.
