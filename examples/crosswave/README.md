# Crosswave media explorer

The config uses the published `@dirwell/*` API with an explicit theme. Input files live in `files/`.

From an installed repository checkout:

```sh
node scripts/build-example.ts crosswave ./generated-crosswave
```

`config.ts` exports core `GenerateOptions`; it is consumed by this SDK build script, not discovered by CLI. For a standalone CLI project, use `dirwell.config.mjs` with `{ theme, build, server, listing }`. Build replaces its dedicated output tree. Serve the complete result over HTTP. `SITE_BASE=/dirwell/ pnpm site:build` publishes every example for the documentation site.
