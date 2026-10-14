---
title: CLI
description: Build static output or serve current files with Plain included.
---

Install nothing globally: use `npx @dirwell/cli`. For repeated project use, install `@dirwell/cli` as a dev dependency and run `npx dirwell`.

```sh
npx @dirwell/cli --help
npx @dirwell/cli server ./files
npx @dirwell/cli build ./files --out ./generated
```

Both commands require an existing source directory. Build also requires a dedicated `--out`; it replaces the generated tree. Server owns its HTTP lifecycle, prints a URL and stops with Ctrl+C. It reads current data without generating static output or starting a filesystem watcher.

## Options

| Scope  | Flags                                                                    |
| ------ | ------------------------------------------------------------------------ |
| Both   | `--theme`, `--config`, `--page-size`, `--block-size`, `--help`           |
| Build  | `--out`, `--mode ssg\|mpa`, `--urls relative\|base\|html-base`, `--base` |
| Server | `--host`, `--port`, `--mount`, `--live`                                  |

Pass only options for the selected mode. Page/block sizes are positive integers. `--page-size` requests native HTML pagination from a capable theme; `--block-size` splits public data responses. Rich clients still load the complete directory before filtering or sorting.

## Themes and configuration

Plain is included. Install `@dirwell/theme-ledger` or `@dirwell/theme-crosswave` before selecting `--theme ledger` or `--theme crosswave`.

```sh
npm exec --package=@dirwell/cli --package=@dirwell/theme-ledger -- dirwell server ./files --theme ledger --live
```

Custom themes use `--theme './theme.mjs#createTheme'` or a module default export. Resolution prefers the working project, then packages supplied beside the CLI by npm exec. An explicit theme failure is an error.

The CLI discovers `dirwell.config.mjs` in the working directory. `--config` selects another native JavaScript module. Precedence is `--theme` → `config.theme` → Plain. Server port precedence is `--port` → `PORT` → `config.server.port` → an available port. See [configuration](../configuration/).

There are two commands: `build` and `server`. Source-component HMR uses the optional [authoring API](../themes/#source-component-customization). Server defaults preview safe media and download HTML, SVG and other active formats.
