# Contributing to Dirwell

This guide is for work on Dirwell itself. To use the published package, start
with [Getting started](https://vp-tw.github.io/dirwell/getting-started/).

## Set up a checkout

Use Node.js 26 or later and the pnpm version recorded in `package.json`.

```bash
git clone https://github.com/vp-tw/dirwell.git
cd dirwell
pnpm install --frozen-lockfile
pnpm dirwell serve ./fixture
```

Open the printed `Local:` URL; Ctrl+C stops the server. The repository's
`pnpm dirwell` script runs the source CLI. User-facing instructions should use
the published scoped package, not assume a checkout.

## Validate a change

```bash
pnpm check
pnpm test
pnpm build
pnpm verify:package
```

For browser behavior, install Chromium once and run the browser tests:

```bash
pnpm exec playwright install chromium --only-shell
pnpm test:browser
```

For documentation and live examples:

```bash
pnpm site:build
pnpm docs:dev
```

The first builds `site/`; the second builds the examples, serves the docs, and
watches source changes. `SITE_BASE=/dirwell/ pnpm site:build` checks the GitHub
Pages prefix. `pnpm docs:build` alone does not regenerate explorer examples.

## Documentation map

| Reader or task                       | Source                                                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| New package user                     | [README](README.md), [docs overview](docs/src/content/docs/overview.mdx), [getting started](docs/src/content/docs/getting-started.md)     |
| Usage and public contracts           | [Docs guides and reference](docs/src/content/docs), [theme architecture](THEMING.md), [theme package contract](THEME_PACKAGE_CONTRACT.md) |
| Integration promises and limits      | [Support policy](docs/src/content/docs/support.md), [verified build behavior](docs/src/content/docs/build-tools.md)                       |
| Implementation and product decisions | [Architecture](ARCHITECTURE.md), [product](PRODUCT.md), [experience](EXPERIENCE.md)                                                       |
| Interface design                     | [Official site](DESIGN.md), [Ledger](src/theme-default/DESIGN.md), [Plain](src/theme-plain/DESIGN.md)                                     |
| Performance evidence                 | [Recorded benchmarks](BENCHMARKS.md)                                                                                                      |
| Historical decisions                 | [Unplugin evaluation](UNPLUGIN_EVALUATION.md), [timestamp presentation](TIMESTAMP_PRESENTATION.md)                                        |
| Package release                      | [Releasing](RELEASING.md), [trusted publishing](TRUSTED_PUBLISHING_PLAN.md)                                                               |

Keep the docs site and packaged README aligned with current code. Put the first
working command before advanced options. Label historical evidence instead of
presenting it as current support. Example input documents are specimen content,
not package instructions. The `docs/examples/api-reference/` snippets are checked
TypeScript; test new commands against an installed package in a fresh project.

## Alpha releases

Add a Changesets note for package changes, including packaged README updates.
Keep releases on `alpha`. Review and merge the version before dispatching the
OIDC workflow. The site deploys separately from `main` through GitHub Pages.
Follow [RELEASING.md](RELEASING.md) for source, artifact, registry, and provenance
verification. Do not republish an existing version.
