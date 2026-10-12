# @dirwell/cli

Unreleased alpha workspace. Install a theme separately; no default theme is selected.

```sh
npm install @dirwell/cli@alpha @dirwell/theme-plain@alpha
npx dirwell build ./files --out ./generated --theme '@dirwell/theme-plain#createPlainTheme'
npx dirwell server ./files --theme '@dirwell/theme-plain#createPlainTheme'
```

`--live` enables shared SSE revision notifications in Svelte/Vue clients. Plain remains script-free.

`build` writes a dedicated static output tree. `server` renders HTML and reads listings/files live without generating a tree or using a watcher. It defaults to loopback, an ephemeral port, and safe media previews; HTML, SVG and other files download. Use `--port`, `--host` and `--mount` explicitly when needed. `PORT` is accepted for development proxies such as Portless.

A JavaScript module passed through `--config` exports `{ theme, listing, build, server }`. Build options retain core filtering, sorting, metadata, symlinks and output-name policies. Server options provide filtering, sorting, authorization and header hooks. This is executable project configuration. For theme factories, use `--theme 'package#exportName'`; the package resolves from the working project. Unsupported legacy dev/daemon commands do not silently change behavior.

`--page-size` and `--block-size` override the corresponding static policy as a pair. When only one is given, the other publication strategy is `all`. HTTP cache defaults to no-store; headers are configurable through the server config.

Server mode replaces file-data rebuild/watch loops. Editing theme source still requires its framework compiler and a server restart; this is not framework HMR. Farm is not part of this server runtime.
