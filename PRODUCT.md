# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dirwell is for developers and maintainers who need to publish or inspect a directory as a website without building a bespoke file browser. It serves local review, release downloads, generated artifacts, documentation attachments, and small public archives.

## Product Purpose

Dirwell turns a directory into a static, accessible file explorer. It should be useful from the first CLI command, while leaving URL layout, generated page strategy, symlink policy, naming, and rendering replaceable for projects with stricter deployment or brand requirements.

## Positioning

Dirwell combines static output with file-explorer behavior: it builds plain deployable files, preserves filesystem context, treats symlink states explicitly, and exposes typed theme components instead of requiring users to fork a fixed HTML template.

## Operating Context

Users run Dirwell through a CLI or its TypeScript API. They may preview a directory with a watch server, build it for a static host, or keep a daemon running. Deployments may live at a domain root or a nested base path such as GitHub Pages. The documentation site and several independently built examples are published under one site base.

## Capabilities and Constraints

- Zero-configuration `serve` and `build` commands, plus daemon operation.
- SSG and MPA output modes.
- Relative, deployment-base, and native HTML `<base>` URL strategies.
- Directory-aware output naming that may skip generation by returning `null`; the default preserves existing `index.html` and `index.htm` files.
- Watch mode with live reload.
- Local and global fuzzy search, type filters, configurable sorting, IME-safe keyboard input, Backspace parent navigation, linked breadcrumbs, and system/light/dark appearance controls.
- The default theme keeps complete HTML listings in SSG mode. With its default settings, MPA directories above 500 entries use a data asset and a virtual list when the default row components are present; those listings require JavaScript.
- Symlinks remain visible. Cycles are navigable without recursive generation. Broken targets expose their declared text through a safe raw-file route; out-of-root targets have no link.
- Themes may replace typed components, add assets, wrap defaults, or replace the full document.
- Generated sites must work as static files without a required application server.
- The public repository is [vp-tw/dirwell](https://github.com/vp-tw/dirwell), and the documentation site is deployed at [vp-tw.github.io/dirwell](https://vp-tw.github.io/dirwell/). Generated sites remain configurable for other hosts and base paths.

## Brand Commitments

The product name is Dirwell. The project is MIT-licensed. Product writing is direct, concrete, and technical without sounding like a framework landing-page template. The default explorer is calm, compact, and usable before customization.

## Evidence on Hand

The public repository contains the CLI, generator, watch server, daemon, default theme, component theme API, tests, a fixture directory, architecture and experience documents, and a Starlight documentation site. There are no verified customer quotes, adoption metrics, or production logos; the website must not fabricate them.

## Product Principles

- The first command should produce a useful result.
- Static deployment must remain understandable and portable.
- Filesystem edge cases stay visible instead of being silently discarded.
- Defaults provide a finished experience; advanced users retain control over rendering and URLs.
- Examples prove behavior with runnable output and source, not marketing claims.

## Accessibility & Inclusion

Keyboard navigation, visible focus, reduced-motion support, readable contrast, and IME-safe search are product behavior rather than optional theme polish.
