---
title: Directory URLs
description: Choose one Core routing policy for page links, static output and live HTML.
---

Directory routing belongs to Core. Set `routing.directoryUrls` once; every theme receives the same resolved links. The default is `explicit`. Routing changes explorer pages, not the names or bytes of your downloadable files. It does not configure your hosting provider.

This guide describes SDK `0.0.3`. It changes the directory URL and theme-context contracts from `0.0.2`; upgrade the official package family together and follow the migration section below.

## Choose a policy

| Policy               | Public child URL               | Static HTML output  | Host requirement                                                                           |
| -------------------- | ------------------------------ | ------------------- | ------------------------------------------------------------------------------------------ |
| `explicit` (default) | `/downloads/folder/index.html` | `folder/index.html` | Exact file serving                                                                         |
| `slash`              | `/downloads/folder/`           | `folder/index.html` | Directory-index lookup                                                                     |
| `clean`              | `/downloads/folder`            | `folder.html`       | Extensionless HTML mapping, with file mapping taking precedence over a same-stem directory |

For `clean`, the archive root remains the deployment root (`/downloads/`) in static builds; it is written to `index.html`. The live root is `/downloads/browse`. Root URLs are not produced by blindly removing their last character.

Use `explicit` for direct file access and Plain navigation through `file://`. Choose `slash` when your host serves a directory's `index.html`. Use `clean` only after checking both the intended page and the downloads under the same real directory. A host that gives `folder/` priority over `folder.html` needs a suitable routing configuration or a different policy.

Some hosts redirect `/folder/index.html` or `/folder.html` to a shorter URL. Inspect the final URL: an explicit generated link cannot override a host redirect. See [deployment](../deployment/) and [troubleshooting](../troubleshooting/#nested-pages-or-assets-fail).

## Set the shared policy

```js
// dirwell.config.mjs
import { createPlainTheme } from "@dirwell/theme-plain";
export default {
  routing: { directoryUrls: "explicit" },
  theme: createPlainTheme(),
  build: { urlStrategy: "relative" },
  server: { mountPath: "/downloads" },
};
```

The CLI forwards the top-level policy to build or server. `--directory-urls explicit|slash|clean` overrides it. Routing is not a theme option or a nested `build`/`server` setting in the CLI config. API and build-adapter callers supply their own `routing` directly.

```js
import { generateExplorer } from "@dirwell/core";
import { createPlainTheme } from "@dirwell/theme-plain";
await generateExplorer({
  sourceDir: "./files",
  outputDir: "./generated",
  routing: { directoryUrls: "clean" },
  theme: createPlainTheme(),
});
```

An absent policy or empty object selects `explicit`. Null, unknown keys and invalid enum values fail before publication/server startup; they do not fall back to a theme default.

## Relative references

`urlStrategy` is a separate build concern:

- `relative` resolves links from each planned public document URL; default.
- `base` roots links under `base`, such as `/project/downloads/`.
- `html-base` emits an HTML `<base>` and resolves generated references against it. This also affects your custom relative links, forms and fragments.

For a file at `folder/note.txt`, `note.txt` works from `/folder/index.html` or `/folder/`. From `/folder`, that reference would resolve outside the folder, so Core emits `folder/note.txt` instead. Do not trim slashes or append filenames yourself. Listing JSON uses its documented `hrefBase`, independently of the HTML base element.

`ssg` and `mpa` control theme-asset placement, not directory URL policy. HTML pagination and JSON blocks also remain independent. Static pagination writes actual page files; query-only pagination is reserved for the live server.

## Existing pages and conflicts

The default resolver preserves source `index.html` and `index.htm`. Its explorer page uses the explicit `_dirwell.html` fallback, even under `slash` or `clean`; this prevents the explorer URL from becoming the owned homepage. Its later pagination files also stay explicit and co-located. If that fallback is occupied too, the explorer page is skipped.

`outputName` remains an explicit filename override or async directory callback. A custom filename other than `index.html` requires `routing.directoryUrls: "explicit"`. Returning `null` skips that explorer page. An owned homepage remains an exit; a skipped directory without a homepage has no generated navigation link. Descendant pages can still be generated, and unavailable ancestor breadcrumbs render as text.

Homepage recognition uses selected entries. Excluding every `index.html` also hides owned homepages from the planner: if their directory is skipped, its navigation link becomes unavailable. Keep owned-site homepages selected, and exclude only obsolete generated listing pages when replacing them. Verify both the explorer listing and the original site entry after changing selection.

A caller-forced `index.html` cannot replace a source homepage anymore. Clean output also cannot replace a real `folder.html` download. Source/output page collisions, including case and normalized-name conflicts, fail without replacing the previous successful output. Change the policy or explicit output name, or deliberately change source selection; do not rename downloads automatically.

The source-root name `__dirwell` is reserved for generated resources, including
case variants. Keep original content outside that namespace. Custom output
filenames must be single filenames without path separators or control characters.

`mirror: false` avoids copying source files. It does not host them: keep the same file layout or use `fileHref` for files on another origin. File URL mapping does not rewrite page, data, asset or signed download URLs. Publish every generated resource needed by the selected theme; an HTML-only copy is not generally sufficient.

## Live routes

With `mountPath: "/downloads"`:

| Policy     | Root HTML                      | Child HTML                            |
| ---------- | ------------------------------ | ------------------------------------- |
| `explicit` | `/downloads/browse/index.html` | `/downloads/browse/folder/index.html` |
| `slash`    | `/downloads/browse/`           | `/downloads/browse/folder/`           |
| `clean`    | `/downloads/browse`            | `/downloads/browse/folder`            |

The server validates and authorizes the requested logical directory and its resolved target before canonical redirects. GET/HEAD aliases receive temporary 307 redirects with their query string preserved. Unsupported methods receive 405. Downloads, JSON, page snapshots and SSE keep their separate route namespaces.

In `clean` mode, `index.html` can be an actual directory name, so it is not stripped as an alias suffix. Old explicit URLs do not automatically alias into clean routes: review migration links or configure unambiguous redirects in the hosting application. This prevents a real directory from being mistaken for its ancestor's homepage.

## Qualify your host

1. Publish a small archive containing a nested directory, a file with spaces/`#`/`%`, an owned homepage and at least two listing pages.
2. Open root and child URLs directly with JavaScript disabled. Check child, parent, Home, pagination and the exact downloaded bytes.
3. Repeat with JavaScript enabled for rich themes. Check reload, Back/Forward, folder snapshots, manifest blocks and assets; a generic SPA-shell 200 response is a failure.
4. Inspect final URLs, redirect chains and optional canonical metadata under both the intended root/subpath and preview/custom-domain configuration. Test `folder` alongside its physical `folder/` downloads for clean routing.
5. Publish the complete output coherently. Switching policy can change bookmarks, cached redirects and third-party theme contracts; preserve aliases where the host supports them and retain output/configuration for rollback.

The automated fixtures qualify explicit file serving, directory-index serving and an explicit file-first clean mapping. They are not a claim about every Firebase, Cloudflare, Vercel, S3 or reverse-proxy configuration. Consult each provider's current documentation and retain the actual configuration and request evidence.

## Migrate theme code

Remove `portableLinks` from Plain. Use Core `routing.directoryUrls: "explicit"` for the old true setting or `"slash"` for false. The removed option throws a migration error.

Custom themes consume `context.hrefFor`, nullable `hrefForDirectory`, and the supplied pagination links. Render unavailable directory targets as text. `assetHrefForDirectory(directory, filename)` resolves theme-owned assets; `directoryPathForEntry(entryId)` supplies a permitted generated directory identity or null. Use these identities rather than inferring a directory from an HTML URL. `pageDataHref` continues to describe live snapshot endpoints.

See [API reference](../api-reference/), [configuration](../configuration/), and [themes](../themes/).
