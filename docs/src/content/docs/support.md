---
title: Support and verification
description: Choose packages and integrations using their tested boundaries.
---

Use the published `@dirwell/*` family. All nine packages share `0.0.3`, selected by `latest`. The 0.0.x API may evolve: pin the version you qualified and upgrade the official family together. Node.js 22.12 or later is required.

## Package boundaries

CLI includes Plain. Core, integrated HTML and build adapters require an explicit theme. Ledger uses Svelte; Crosswave uses Vue and VueUse. Share metadata/image rendering and source authoring are optional packages. Core and Plain do not install frameworks, fonts, image renderers or watchers.

## Verified scope

The SDK release passed installed-package checks on Linux, Windows and macOS in ARM64/x64 variants across Node 22.12, 24.1 and 26. Checks exercise three themes, SSG/MPA, live listing/file transfer/archive queries, custom-font PNG images, CLI and paired source compilation. Browser coverage exercises pagination without JavaScript, search/sort, navigation/history, live refreshes and simulated gamepad input. See the [verification record](https://github.com/vp-tw/dirwell/blob/main/VERIFICATION.md) for evidence and qualifications.

Native Node, Express 5, Fastify 5 and Hono 4 server integrations have executed tests. Fetch interfaces do not qualify other hosts or edge runtimes: filesystem access requires Node.

## Build adapters

Vite, Rollup and webpack are primary paths. Rolldown, Rspack, Rsbuild, esbuild, Farm and Bun use existing host-specific adapters with varying qualification. Consult [build tools](../build-tools/) before relying on watch behavior. Farm standalone build-watch is limited for non-module file changes; an adapter being available does not prove host feature parity.

## Browser and device verification

Browser regressions cover keyboard operation, desktop/mobile viewport sizes and native browsing without JavaScript. Physical iOS and real screen-reader output have not completed device qualification. These are pending verification paths for `0.0.3`, rather than supported-device guarantees.

## Limits

Hostile filesystem mutation, distributed caching and production-scale performance are not fully qualified. Rich clients load the complete directory. Ledger and Crosswave window large rendered lists while retaining full directory data. Opt-in live archive queries search fresh names/paths under entry, directory, concurrency and time budgets; they do not download a complete browser archive index. Source HMR and file-data refresh are separate mechanisms.

Controller polling uses VueUse `useGamepad`; regression covers simulated standard input, held buttons, deadzones, disconnects and unavailable APIs. Physical-controller testing is not a separate `0.0.3` release gate.

## Directory URL qualification

Routing tests cover a synthetic exact-file host, directory-index lookup, file-first extensionless mapping, three official themes, native pagination and live routes. They do not establish vendor-wide defaults. Qualify the actual deployed configuration, prefix, redirect chain, canonical metadata and downloaded bytes. Rich-theme file-URL fetch behavior remains outside the native Plain guarantee. See [directory URLs](../urls/).
