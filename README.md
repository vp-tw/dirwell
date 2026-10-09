# Dirwell

Turn a folder of downloads, reports, or build artifacts into a searchable website.
Dirwell generates the file list, directory navigation, and links to the original
files. Publish the output on a static host; visitors do not need a Dirwell server.

[Try the live explorer](https://vp-tw.github.io/dirwell/examples/file-icons/) ·
[Get started](https://vp-tw.github.io/dirwell/getting-started/) ·
[Documentation](https://vp-tw.github.io/dirwell/overview/)

## Browse your first folder

You need **Node.js 26 or later**, which includes npm. From a terminal, replace
`./downloads` with a folder that already exists:

```bash
npx @vp-tw/dirwell@alpha serve ./downloads
```

Accept npm's installation prompt on first use. Open the `Local:` URL printed by
Dirwell. Add or change a file to see the list update. Press Ctrl+C to stop.
No repository clone or config file is required.

Dirwell is currently **alpha**. Use `@alpha` explicitly; the `latest` npm tag
remains on the bootstrap alpha and does not select the newest alpha.

## Publish the folder

```bash
npx @vp-tw/dirwell@alpha build ./downloads -o ./site-downloads
```

Upload the complete `site-downloads/` directory to a static host. The default
output uses relative links so it can move between URL paths as one tree. The
command replaces that output directory; keep unrelated files elsewhere.
Existing source `index.html` and `index.htm` files are preserved, with the
explorer written to `_dirwell.html` when that name is free.

The default Ledger theme includes search, sorting, file icons, and keyboard
navigation. Files open in a new tab; directory navigation stays in the explorer.
Default output includes the listing in HTML and remains browsable without
JavaScript. Advanced MPA output can use JavaScript for large directory lists.

## Use it in a project

Install the package when you need a reusable config, a theme, or a build adapter:

```bash
npm install --save-dev @vp-tw/dirwell@alpha
```

Create `dirwell.config.ts` beside your project's `package.json`:

```ts
import { defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  exclude: ["drafts/**"],
});
```

Run `npx dirwell build ./downloads -o ./site-downloads`. Pass the source folder
explicitly: the CLI defaults to the current directory even if config sets `root`.
Pin your tested version when you need reproducible alpha builds.

## Choose your next step

| Need                                                 | Read                                                                                                            |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Publish under a fixed path, such as GitHub Pages     | [Deployment](https://vp-tw.github.io/dirwell/deployment/)                                                       |
| Select files, change output names, or configure URLs | [Configuration](https://vp-tw.github.io/dirwell/configuration/)                                                 |
| Change the interface or use a no-script listing      | [Themes](https://vp-tw.github.io/dirwell/themes/)                                                               |
| Generate alongside an existing application           | [Build tool adapters](https://vp-tw.github.io/dirwell/build-tools/)                                             |
| Check supported integrations and limitations         | [Support policy](https://vp-tw.github.io/dirwell/support/)                                                      |
| Call Dirwell from Node.js or write a theme package   | [API reference](https://vp-tw.github.io/dirwell/api-reference/) · [Theme contract](./THEME_PACKAGE_CONTRACT.md) |
| Resolve setup, output, or link problems              | [Troubleshooting](https://vp-tw.github.io/dirwell/troubleshooting/)                                             |

Build-tool support is selective. Vite, Rollup, and webpack are the primary
integrations; the other existing adapters are experimental. Unplugin supplies
shared plugin interfaces, not a promise that every tool or website framework
has identical behavior. See the support policy before choosing an adapter.

## Contribute

For repository setup, tests, examples, architecture, and release instructions,
see [Contributing](https://github.com/vp-tw/dirwell/blob/main/CONTRIBUTING.md).

Dirwell's code is MIT licensed. Ledger's bundled file icons have separate
attribution and license terms in [third-party notices](./THIRD_PARTY_NOTICES.md).
