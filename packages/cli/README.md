# @dirwell/cli

Requires Node.js 22.12 or later. [Read the guide](https://vp-tw.github.io/dirwell/getting-started/).

Build a static file explorer or serve a live folder. Plain is included as the
minimal default: no browser JavaScript, framework, fonts or share images.
Other themes remain separate installs.

Starting with `0.0.1-alpha.1`, the CLI defaults to Plain and supports short theme
names and automatic `dirwell.config.mjs` discovery. Version `0.0.1-alpha` requires an explicit
`--theme '@dirwell/theme-plain#createPlainTheme'` and a project-installed theme.

## Open or publish a folder

```sh
npx @dirwell/cli@alpha server ./files
npx @dirwell/cli@alpha build ./files --out ./generated
```

No project, configuration file or global installation is required. Open the URL
printed by `server`; Ctrl+C stops it. New filesystem data appears on subsequent
requests. `build` replaces a dedicated static output tree: keep unrelated files
out of that directory. Both commands require an explicit source folder.

Server defaults to loopback, an ephemeral port and safe media previews. HTML,
SVG and other active formats download. Use `--port`, `--host` and `--mount`
explicitly when needed. `PORT` is accepted for proxies such as Portless. Port precedence is `--port`, then
`PORT`, then `config.server.port`, then an ephemeral port. Config can also set
`server.host`; `--host` overrides it.
`--live` enables automatic Svelte/Vue updates through shared SSE notifications;
Plain remains script-free. Server mode does not generate a tree or need a
filesystem watcher. Theme-source HMR belongs to the optional authoring package.

## Upcoming stable selection and output controls

These controls are under development and are not available in the published alpha.

The CLI reads an optional `.gitignore` in cwd by default. Use repeatable `--ignore-file <path>` to replace that list, or `--no-ignore` to disable it. Config supports shared `ignoreFiles`, overridden by `build.ignoreFiles` or `server.ignoreFiles`; `[]` disables defaults. Paths resolve from cwd; rules use the file's directory as their base. Use `{ path, baseDir, optional }` for shared rules or optional files. Files sharing a pattern base are concatenated in order; deeper scopes override parent scopes. Glob exclusions always win, and include globs do not bypass ignore rules.

Builds replace missing, empty or Dirwell-marked output directories. A nonempty unmarked directory requires `--force` / `-f`; force never permits replacing source or a symlink/file destination. `--dry-run` reports selection and planned directory pages without writing output. `defineConfig` from `@dirwell/cli` provides editor types and runtime validation; nested option typos fail before build/server startup.

## Theme selection and customization

For repeated project use, install the CLI and the theme you want:

```sh
npm install --save-dev @dirwell/cli@alpha @dirwell/theme-ledger@alpha
npx dirwell server ./files --theme ledger
```

`--theme plain`, `--theme ledger` and `--theme crosswave` select the official
factories. Custom packages or local modules use `--theme 'module#factory'`, or a
module's default theme/factory export. Resolution prefers the working project,
then packages installed beside the CLI by `npm exec --package=...`. The CLI
never downloads a theme itself or falls back to Plain when an explicit theme fails.

For theme options, write `dirwell.config.mjs` in the working directory:

```js
import { createLedgerTheme } from "@dirwell/theme-ledger";

export default {
  theme: createLedgerTheme({ title: "Downloads" }),
  build: { exclude: ["drafts/**"] },
  server: { exclude: ["drafts/**"] },
};
```

Then run either command without `--theme`. `--config ./other.mjs` selects another
JavaScript module. Configuration is executable trusted project code, loaded by
Node without a config loader or TypeScript compiler. Theme precedence is
`--theme`, then `config.theme`, then Plain. A missing default file is optional;
an explicit missing file or a broken config fails visibly. If only an unsupported
`dirwell.config.ts`, `.mts`, `.js` or `.cjs` exists, the CLI stops and asks for
renaming or explicit `--config` selection rather than ignoring selection rules.
Automatic discovery uses only `.mjs`; explicit config must run as native JavaScript
on your supported Node version.

The config exports only `{ theme, listing, build, server }`; unknown top-level
keys fail instead of silently dropping options. Put `exclude`/`include`
in `build` and/or `server`. Export a resolved object, using top-level await
for asynchronous setup. Shared `listing` accepts
fixed plans or per-directory callbacks. `build` retains core filtering, sorting,
metadata, symlinks and output-name policies. `server` provides filtering, sorting,
authorization and header hooks; HTTP cache defaults to no-store. Build metadata
and archive search are not live-server features.

`--page-size` and `--block-size` override the corresponding static policy as a
pair. When only one is given, the other publication strategy is `all`.
Mode-specific flags fail when used with the other mode. Legacy dev/daemon
commands are unsupported; the CLI does not silently translate them.
