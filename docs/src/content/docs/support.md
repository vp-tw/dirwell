---
title: Support and compatibility
description: Understand supported integrations and verified limits.
---

Use the CLI for a folder you want to browse or publish. You only need a build
adapter when Dirwell must run alongside an existing application's build.

Install `@vp-tw/dirwell` for the current release. Pin the version you tested for repeatable builds. The sections below describe tested capabilities and known limits.

## Build-tool support policy

Dirwell prioritizes a small set of integrations. It does not aim to cover every
target available in Unplugin or make all targets behave identically.

| Tier         | Tools                                         | What to expect                                                                                                                                                                               |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary      | Vite, Rollup, webpack                         | Maintained integration paths with build tests and source-watch tests. Vite also has development-server and browser-reload tests.                                                             |
| Experimental | Rolldown, Rspack, Rsbuild, esbuild, Farm, Bun | Existing adapters remain available. Use only the behaviors listed in the [verification matrix](../build-tools/#development-and-verification); additional modes may be unverified or limited. |
| Not provided | Unloader                                      | The pinned Unplugin 3.4.0 has an entry, but Dirwell has no public adapter or verification for it.                                                                                            |

These tiers describe maintenance priority, not a guarantee that
all modes or versions of a primary tool work. The verification matrix states
what is actually tested. We do not remove an existing adapter simply because it
is experimental. Promotion needs a real use case, repeatable tests, and a clean
way to stop any resources the adapter starts. New adapters and special watch
helpers are not automatic backlog items.

### Why Unplugin does not mean identical support

Unplugin shares plugin interfaces for code transformation and build hooks.
Dirwell also generates files, observes directory creation and deletion, mounts
output in development servers, and removes stale output. Those behaviors depend
on each host's APIs and lifecycle. A supported Unplugin target provides an
integration entry; it does not supply every directory-explorer behavior.
See [Unplugin's hook comparison](https://unplugin.unjs.io/guide/#supported-hooks).

Farm illustrates the boundary: its Dirwell build and development serving are
tested, but native standalone watch leaves explorer source output stale after
additions, modifications, and deletions. This remains a
[documented limitation](https://github.com/vp-tw/dirwell/issues/43).
No separate Dirwell-managed Farm watch helper is provided.

### Website frameworks

Astro, Docusaurus, Nuxt, and other website frameworks can expose an underlying
build tool's plugin configuration. That makes integration possible; it does
not establish Dirwell compatibility. Dirwell does not currently publish dedicated
framework adapters or claim end-to-end framework support. The Astro documentation
site in this repository copies prebuilt explorer examples; that is not proof of
a Dirwell adapter running inside Astro's own build or development lifecycle.

## Runtime and browser expectations

The package requires Node.js 26 or later. Generated websites need a static file
host, not Node.js. Ledger is the default theme; its normal SSG listing remains
usable without JavaScript. Search, sorting controls, appearance preferences,
and large MPA virtualized lists need JavaScript. Plain renders complete HTML
without a runtime in either mode.

Full regression has passed locally in Chromium, Firefox, and Playwright WebKit.
CI runs the full Chromium suite and a bounded cross-engine suite for theme
contracts and global-search IME behavior. Additional local checks cover native
macOS Safari navigation and iPhone/iPad Safari simulators' layout and scripted
controls. These checks do not establish physical iOS behavior or full engine
parity. See the [verification record](https://github.com/vp-tw/dirwell/blob/main/VERIFICATION.md)
for versions, methods, and limits. Choose plain HTML or validate your target
browsers when those environments matter.

## Themes and language

Themes own presentation, browser behavior, and localization. Ledger, Plain, and Crosswave
use English. The [i18n example](../examples/) demonstrates English, Traditional
Chinese, and Japanese in an independent theme. Copy controls and file previews
are optional theme features, not promised basic-theme functionality.

Independent theme packages should pin the versions they have tested and
retest before widening that range. See [theme packages](../themes/#independent-theme-packages).

## Report a problem

[Open an issue](https://github.com/vp-tw/dirwell/issues) with the Dirwell and Node
versions, command or config, operating system, build tool if any, and a small
source tree that demonstrates the problem. State the expected output and what
actually happened. Remove private file contents and paths from the reproduction.
