---
title: CLI
description: Build, serve, and operate Dirwell as a detached process.
---

## Default command

```bash
dirwell [directory]
```

The default command is `serve`. It watches files and enables live reload.

## Build

```bash
dirwell build [directory] [--out-dir path] [--mode ssg|mpa]
  [--urls relative|base|html-base] [--base /repository/]
```

`build` writes deployable files and exits. Its default output is `dist/`.

## Serve

```bash
dirwell serve [directory] [--host host] [--port port]
  [--urls relative|base|html-base] [--base /repository/]
dirwell dev [directory]
```

`dev` is an alias for `serve`. `PORT` and `HOST` environment variables are
honored, which lets Portless and similar supervisors assign the listener.

## Daemon

```bash
dirwell daemon start [directory]
dirwell daemon status
dirwell daemon stop
```

Daemon state and logs are stored under `.dirwell/` in the configuration working
directory. A stale state file is reported as stopped and may be replaced by a
new start.

## Help

Every command exposes generated help:

```bash
dirwell --help
dirwell build --help
dirwell daemon --help
```
