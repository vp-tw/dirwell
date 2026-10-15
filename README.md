# Dirwell

Turn a folder into a browsable website, or serve current files directly. Use the published `@dirwell/*` packages; use Node.js 22.12 or later.

![Dirwell — Turn a folder into a searchable website.](https://raw.githubusercontent.com/vp-tw/dirwell/main/assets/brand/dirwell-og.png)

[Try Ledger](https://vp-tw.github.io/dirwell/examples/file-icons/) · [Get started](https://vp-tw.github.io/dirwell/getting-started/) · [Documentation](https://vp-tw.github.io/dirwell/overview/)

## Open or publish a folder

```sh
npx @dirwell/cli server ./downloads
npx @dirwell/cli build ./downloads --out ./site-downloads
```

No project or config is required. Plain is included: native links and pagination, no browser JavaScript, fonts or share images. Server prints its URL and reads fresh data on requests; Ctrl+C stops it. Build replaces a dedicated output tree and copies selected source files. Publish the complete tree on a static host; keep unrelated files out of that directory.

For a searchable interface, install a rich theme:

```sh
npm install --save-dev @dirwell/cli @dirwell/theme-ledger
npx dirwell server ./downloads --theme ledger --live
```

Use `dirwell.config.mjs` to configure themes, selection and server/build options. Ledger uses Svelte; Crosswave uses Vue. Both remain separate optional installs. Core and integrations require explicit themes.

## Packages

| Need                                        | Package                    |
| ------------------------------------------- | -------------------------- |
| Minimal build/server commands               | `@dirwell/cli`             |
| Filesystem, listing and static build API    | `@dirwell/core`            |
| Native HTML                                 | `@dirwell/theme-plain`     |
| Search, sort and keyboard navigation        | `@dirwell/theme-ledger`    |
| Media categories and controller navigation  | `@dirwell/theme-crosswave` |
| Node HTTP routes and live file transport    | `@dirwell/server`          |
| Build-time metadata and PNG images          | `@dirwell/share-image`     |
| Static generation inside build tools        | `@dirwell/integrations`    |
| Svelte/Vue source compilation and local HMR | `@dirwell/theme-authoring` |

All nine share version `0.0.3` and the `latest` tag. Pin the tested version for reproducible builds. Core and Plain stay free of framework/image/font/watch dependencies. See the [SDK guide](https://vp-tw.github.io/dirwell/sdk/) for API, live server and listing policy examples.

## Learn more

| Task                               | Guide                                                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Configure files, themes and URLs   | [Configuration](https://vp-tw.github.io/dirwell/configuration/)                                                       |
| Publish under a fixed URL prefix   | [Deployment](https://vp-tw.github.io/dirwell/deployment/)                                                             |
| Choose or customize an interface   | [Themes](https://vp-tw.github.io/dirwell/themes/)                                                                     |
| Add titles and share images        | [Metadata](https://vp-tw.github.io/dirwell/metadata/)                                                                 |
| Integrate with a build or Node app | [Build adapters](https://vp-tw.github.io/dirwell/build-tools/) · [SDK](https://vp-tw.github.io/dirwell/sdk/)          |
| Understand API and limits          | [API reference](https://vp-tw.github.io/dirwell/api-reference/) · [Support](https://vp-tw.github.io/dirwell/support/) |
| Fix setup or links                 | [Troubleshooting](https://vp-tw.github.io/dirwell/troubleshooting/)                                                   |

## Verified scope

SDK installed-consumer checks cover Linux, Windows and macOS, ARM64/x64 and Node 22.12/24.1/26: three-theme SSG/MPA, CLI, live listing/files and source authoring. Browser tests cover native pagination, search/sort, history, live updates and simulated gamepads. Physical controller mappings, physical iOS, real screen-reader output and production-scale performance remain unqualified. See [verification](VERIFICATION.md) for evidence boundaries.

## Contribute

For shared `routing.directoryUrls`, homepage coexistence and deployment requirements, see [Directory URLs](https://vp-tw.github.io/dirwell/urls/). The [URL publication design](docs/design/url-publication/README.md) retains the ownership decisions, scenario matrices and verification evidence.

For repository setup, tests, examples, architecture, and release instructions,
see [Contributing](https://github.com/vp-tw/dirwell/blob/main/CONTRIBUTING.md).

Dirwell's code is MIT licensed. Bundled Source fonts and Ledger file icons have separate
attribution and license terms in [third-party notices](./THIRD_PARTY_NOTICES.md).

For dependency audit scope, patched workspace resolutions, and retained development-only findings, see [dependency security](https://github.com/vp-tw/dirwell/blob/main/DEPENDENCY_SECURITY.md). Workspace overrides do not rewrite an installed consumer’s existing lockfile.
