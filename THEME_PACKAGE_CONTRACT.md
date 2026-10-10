# Alpha theme package contract

An independent theme package exports a factory returning `ExplorerTheme` from
`@vp-tw/dirwell`. Consumers import that factory in `dirwell.config.ts`. Complete
renderer replacement is the smallest contract: the package owns its HTML,
styles, assets, options, language controls, and browser behavior.

The [external package example](https://github.com/vp-tw/dirwell/tree/main/examples/theme-package) exercises this boundary
from packed distributions rather than repository source aliases. The
[i18n example](https://github.com/vp-tw/dirwell/tree/main/examples/i18n) separately demonstrates theme-owned localization.

## Public surface

| Surface                  | Contract                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `ExplorerTheme`          | A name, optional `searchIndex` and `metadataDefaults`, and sync/async `render(context)`.                                               |
| `ThemeContext`           | Prepared `DirectoryData`, output mode/name, sort policy, optional HTML base/page `metadata`, asset/index URLs, and navigation helpers. |
| `RenderedPage`           | A complete HTML document and optional map of safe asset filenames to strings or bytes.                                                 |
| Default theme components | Optional typed overrides and ordered layers from `@vp-tw/dirwell/theme`; a full renderer can operate independently.                    |

Use `hrefFor()`, `hrefForDirectory()`, and `exitsExplorerFor()` instead of
reconstructing filesystem or deployment URLs. `hrefFor()` can return `null`;
render an unavailable label in that case. Preserve the caller's HTML base when
`documentBaseHref` is present.

Set `searchIndex: false` when the theme has no global search. Otherwise the
generator can emit index assets, but the theme still owns how they are used.
Styles and tokens remain private to each renderer. Core does not supply a locale
setting; Ledger, Plain, and Crosswave keep their English interfaces.

## Page metadata

A custom theme may include `context.metadata?.head` in its document head, or use the resolved title and description. The generator does not insert tags into custom HTML. `metadataDefaults` is optional. A theme can provide its own `image` source/callback or choose an `imageTheme` preset. Caller `metadata.image` wins, including `false`; callbacks receive resolved page text. Omitting both theme image settings produces text metadata only. Theme-owned local files should use a `file:` URL from `import.meta.url` or a Node `File`; relative strings resolve from the consumer’s config directory. These callbacks receive public counts and names, rather than full Node-side filesystem entries. See [metadata](https://vp-tw.github.io/dirwell/metadata/).

## Assets and trust

The generator validates asset filenames and deploys them beside each SSG page
or in the shared MPA `__dirwell/` directory. Refer to them with `assetHref()`.
For MPA, every use of the same asset filename must provide identical bytes;
conflicting shared assets fail the build. Choose names that do not collide with
selected source files, generated page names, or other theme assets.

Theme packages execute as trusted Node code. Rendering needs prepared source
data rather than a second source-tree traversal; packages may load their own
bundled styles/assets. Treat entry names, declared symlink targets, and visible
paths as untrusted text and escape them before HTML insertion. Avoid serializing
machine-absolute `absolutePath` or `resolvedPath` into browser output. A theme
owns its asset licenses and notices.

## Alpha compatibility

Pin the exact Dirwell alpha used by the theme's tests in `peerDependencies`.
Retest before widening that range or accepting another alpha; this contract is
not a stable API promise. Public types and component contracts may evolve before
stable. Consumers own the decision to upgrade their Dirwell/theme pair.

The proof package deliberately replaces the full renderer. Component overrides
remain supported, but their authors must also verify the default runtime's DOM
expectations, keyboard behavior, virtualization, and theme assets against their
selected alpha version. The [Ledger runtime contract](THEME_RUNTIME_CONTRACT.md) lists the hooks and verification procedure.

## Consumer verification

`pnpm verify:package` packs Dirwell and this private theme separately, installs
them into a fresh project, and exercises their public imports. It verifies the
CLI, an external renderer with SSG/MPA assets and encoded names, public types,
a real Rollup build, and an async CommonJS webpack build. Successful local tarball consumption does not prove npm
publication or a registry install; release readback must verify those separately.
