---
title: CLI
description: Build once, watch locally, or run a detached explorer.
---

From a repository checkout, run the CLI with `pnpm dirwell`. The examples
below use that form. `dirwell` is the executable name when the package is
installed.

| Command                            | Result and use                                                          |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `dirwell [directory]`              | Starts `serve`, the default command, to browse a changing local folder. |
| `dirwell build [directory]`        | Writes static files and exits so you can publish them.                  |
| `dirwell serve [directory]`        | Watches and reloads browsers in a foreground server.                    |
| `dirwell dev [directory]`          | Alias for `serve` when your scripts use `dev` naming.                   |
| `dirwell daemon start [directory]` | Starts a detached server that stays up after the terminal closes.       |
| `dirwell daemon status` / `stop`   | Reads or stops that server.                                             |

The positional `[directory]` defaults to `.` and takes precedence over config
`root`. Pass the intended source path explicitly. Paths in config resolve
from `--cwd`, whose default is the current working directory.

## Build once

```bash
pnpm dirwell build ./public -o ./dist
```

`build` writes a deployable tree. It defaults to SSG, relative URLs, and
`dist/` output. A successful build replaces the generated output tree, so do
not put unrelated files there. Existing source `index.html` or `index.htm`
files remain; their directory explorer page uses `_dirwell.html` when free.

To publish beneath a fixed URL prefix:

```bash
pnpm dirwell build ./public -o ./dist --mode mpa --base /downloads/ --urls base
```

Set `--base` to the path where the output will actually be served. See
[deployment choices](../deployment/) for SSG, MPA, and URL trade-offs.

## Watch locally

```bash
pnpm dirwell serve ./public --host 127.0.0.1 --port 4173
```

`serve` defaults to `.dirwell-preview/` output, host `127.0.0.1`, and port
`4173`. It watches source changes, rebuilds the explorer, and reloads
connected browsers. `--port 0` requests an available port.

## Shared options

| Option           | Input and effect                                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `[directory]`    | Source path; default `.`. Directory to scan; overrides config `root`.                                       |
| `--cwd`          | Directory path; default current working directory. Finds `dirwell.config.ts` and keeps daemon state here.   |
| `--mode`         | `ssg` or `mpa`; config or default `ssg`. Selects the output mode.                                           |
| `--urls`         | `relative`, `base`, or `html-base`; config or default `relative`. Selects generated link form.              |
| `--base`         | Root-relative path or HTTP(S) URL; config or default `/`. Public prefix for `base` and `html-base` URLs.    |
| `-o`, `--outDir` | Directory path; default `dist/` for build or `.dirwell-preview/` for serve. Sets generated output location. |

`serve`, `dev`, and `daemon start` also accept:

| Option         | Input and effect                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `--host`       | Hostname or address; default `127.0.0.1`. Sets the listening interface.                              |
| `-p`, `--port` | Integer from `0` to `65535`; default `4173`. Sets the listening port; `0` chooses an available port. |

For host and port, a CLI option wins over `HOST` or `PORT`, then config
`server.host` or `server.port`. The environment variables let a process
supervisor assign the listener. Other behavior such as `include`, `exclude`,
`sort`, and `theme` belongs in [configuration](../configuration/).

## Detached server

```bash
pnpm dirwell daemon start ./public
pnpm dirwell daemon status
pnpm dirwell daemon stop
```

`daemon` defaults to `start`. State and logs live under `.dirwell/` in
`--cwd`. Use the same `--cwd` for `status` and `stop` that you used for
`start`. A stale state file is reported as stopped and may be replaced by a
new start.

For exact spelling and installed-version options, run `dirwell build --help`
or `dirwell serve --help`.
