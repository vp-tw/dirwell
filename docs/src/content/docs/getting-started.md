---
title: Getting started
description: Turn your first folder into a browsable website, then publish it.
---

You need **Node.js 26 or later**, which includes npm, and a folder to browse.
Check your Node version with `node --version`. You do not need to clone Dirwell
or choose a build tool.

Want to see the result first? [Open the live explorer](https://vp-tw.github.io/dirwell/examples/file-icons/).

## 1. Browse a folder

Replace `./downloads` with an existing folder on your computer:

```bash
npx @vp-tw/dirwell serve ./downloads
```

Accept npm's installation prompt on first use. Open the `Local:` URL printed by
the command. You should see your folders and files; open a directory, search
for a file name, or follow a file link. Adding, changing, or deleting a source
file updates the listing and reloads the browser. Press Ctrl+C to stop.

See [support and compatibility](../support/) for verified environments and integration limits.

## 2. Build a website

```bash
npx @vp-tw/dirwell build ./downloads -o ./site-downloads
```

This writes the website and copies the source files into `site-downloads/`,
then exits. Publish that complete directory on a static host. You do not need
to run Dirwell on the host. The command replaces its output directory, so
choose a dedicated directory rather than one containing unrelated work.

The defaults produce a page for each directory with relative links. Keep the
output tree together when moving it. You can leave the advanced output and URL
settings unchanged for this first build.

If your source already contains `index.html` or `index.htm`, Dirwell preserves
it and writes its listing as `_dirwell.html`. Open that file to see the explorer.
If `_dirwell.html` is also present, no explorer page is generated there.

For a fixed public path such as `/project/downloads/`, continue with
[deployment](../deployment/).

## 3. Save project settings when needed

Install Dirwell locally so a config file can import its public API:

```bash
npm install --save-dev @vp-tw/dirwell
```

Create `dirwell.config.ts` beside your project's `package.json`:

```ts
import { defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  exclude: ["drafts/**"],
});
```

Run the installed CLI:

```bash
npx dirwell build ./downloads -o ./site-downloads
```

The config is discovered from the current working directory. The positional
source path overrides config `root`, including when omitted: its default is
`.`. Keep the intended folder in the command. For reproducible builds, install
with `--save-exact` and commit the package manager's lockfile.

## Next steps

| You want to                             | Read                                   |
| --------------------------------------- | -------------------------------------- |
| Publish the output                      | [Deployment](../deployment/)           |
| Change selected files or URL layout     | [Configuration](../configuration/)     |
| Change the appearance or use plain HTML | [Themes](../themes/)                   |
| Integrate with an application's build   | [Build tool adapters](../build-tools/) |
| Fix a problem with these steps          | [Troubleshooting](../troubleshooting/) |

To work on Dirwell itself, use the repository's
[contributor guide](https://github.com/vp-tw/dirwell/blob/main/CONTRIBUTING.md).
