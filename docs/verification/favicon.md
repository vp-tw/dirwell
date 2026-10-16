# Favicon acceptance and verification

## Intended behavior

Official themes accept a favicon that Dirwell publishes from a local image or
references at an existing URL. Ledger and Crosswave default to the website's
approved 16/32/48px paper-bird PNGs. Plain has no default icon. Custom configuration
replaces the default completely, and `false` emits no icon declarations or assets.

`brand.favicon` accepts one descriptor, a nonempty array of descriptors, or `false`.
Each descriptor has exactly one of `source` and `href`, with optional `type`,
`sizes`, and `media`. `source` accepts a `File`, local path string, or `file:` URL.
`href` accepts an HTTP(S) or root-relative URL. Existing `brand.faviconUrl` remains
supported; configuring both names is an error rather than an implicit precedence.

Local paths resolve from cwd when the theme is created. A `file:` URL resolves
independently of cwd. Inputs are snapshotted at theme creation; bytes are read
lazily and cached per instance. Create a new instance after changing an image.
Local images retain their original bytes and receive content-based output names.
No remote download, image conversion, automatic resizing, PWA manifest, or
home-screen icon generation is part of this change.

## Acceptance criteria

1. All three factories accept the documented input forms. Invalid shapes, mixed
   sources, unsupported protocols, invalid attribute values, and conflicting
   configuration fail with actionable errors. Missing local files fail the build
   without replacing the last successful output.
2. Packaged and user-supplied bytes are identical in SSG, MPA, and live responses.
   Shared bytes are deduplicated; disabled and external icons create no copied
   assets. PNG, SVG, ICO, JPEG, GIF, WebP, and AVIF retain matching MIME types.
3. Icon links resolve to their intended resource across every finite matrix case
   below. No local source path or `File` object appears in HTML, page JSON, or
   public model types. User archive files remain intact; collisions fail.
4. Native entry, reload, no-script navigation, in-page folder changes, pagination,
   Back/Forward, and live refresh preserve icon declarations and resources.
   Optional social metadata coexists without duplicates. Head updates preserve
   only allowed inert attributes and reject executable protocols and handlers.
5. Published packages work without the repository's source assets. Documentation
   explains the current API from a new user's perspective, with runnable examples,
   explicit path bases, defaults, replacement rules, and supported boundaries.

## Configuration inventory

| Dimension         | Cases to verify                                                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme             | Plain, Ledger, Crosswave                                                                                                                                                                |
| Favicon input     | Omitted; `favicon: false`; legacy false; File; relative path; absolute path; file URL; root-relative href; HTTP(S) href; legacy root-relative URL; legacy HTTP(S) URL; mixed icon array |
| Static layout     | SSG, MPA                                                                                                                                                                                |
| URL strategy      | Relative, base, HTML base                                                                                                                                                               |
| Deployment base   | Root path; nested path; absolute same-origin URL; absolute different-origin URL                                                                                                         |
| Directory routing | Explicit filename, slash, clean                                                                                                                                                         |
| Output name       | Default index; custom filename                                                                                                                                                          |
| Page state        | Root; nested; deep; first and later listing pages                                                                                                                                       |
| Live mount        | Root; single-segment prefix; nested prefix                                                                                                                                              |
| Local names       | Spaces, non-ASCII text, percent and hash characters                                                                                                                                     |
| Source lifetime   | Initial read; repeated render; cwd change; input mutation; fresh instance after image change                                                                                            |
| Attributes        | Inferred/explicit MIME type; omitted/explicit sizes; SVG `any`; light/dark media conditions                                                                                             |
| Failure           | Missing/unreadable source; unsupported source or URL; invalid descriptors; collision; failed navigation                                                                                 |

The static publication matrix crosses theme, favicon input, layout, URL strategy,
base, directory routing, and output name. Valid builds verify root/nested/deep and paginated output. The existing Core
contract rejects custom filenames with slash/clean routing; these combinations
must fail explicitly instead of producing output. The live matrix crosses theme, input, mount, and directory
routing. Source/attribute/error tests exercise their distinct normalization paths.
Existing listing/routing tests cover mirror, listing-data plans, selection,
skipped/owned pages, and custom file URLs; favicon checks cover their relevant
boundaries without claiming exhaustive enumeration of arbitrary callbacks or strings.

For local assets, resolve output links using the browser's effective document base
and compare their bytes to the input. For `href`, assert standard HTML URL resolution:
root-relative URLs do not acquire the deployment path, and an absolute HTML base
can change their origin. Fully qualified hrefs remain independent of that base.
Rich-theme in-page navigation retains its same-origin snapshot restriction;
cross-origin hosting exercises the documented native fallback boundary.

## Evidence ledger

Local qualification on 2026-10-16 used macOS arm64 and Node 26.12.0:

- `node --test --test-concurrency=1 test/*.test.ts test/*.test.mjs`: 262 passed,
  including 5,184 favicon combinations (3,456 successful static builds and 1,728
  expected custom-name/routing rejections), 324 live configurations, and the
  existing 864-case routing/publication matrix. Valid favicon builds check four
  root/nested/deep/paginated documents each and compare published bytes.
- `pnpm exec playwright test`: 261 passed initially. Two unchanged legacy
  Crosswave navigation cases exceeded their 20-second test limit during concurrent
  qualification; both passed in 5.0 and 3.3 seconds when rerun with the same limit.
  All 40 new favicon cases passed in the full run.
- The favicon guide's five code blocks ran successfully. Packed-consumer checks
  exercised all nine candidate packages, default PNG assets, local source forms,
  static layouts, the live server and Svelte/Vue source authoring. All nine isolated
  README quick starts passed, including the three new favicon snippets.
- Type checking, formatting/lint, template checks, dependency policy, legacy package
  verification, examples and documentation builds passed. Dependency policy retained
  its two already documented Farm development advisories; no dependency was added.
- The compatibility suite runs the 40 favicon cases in Chromium, Firefox and
  WebKit; current-head CI records each engine result. Enabled-script cases decode
  images, while no-JavaScript cases verify icon declarations and fetched bytes.
  Firefox does not settle an evaluated `Image.decode()` promise with scripts
  disabled. Browser chrome, cache persistence, physical iOS and screen-reader
  behavior remain separate from this proof.

The final PR checks qualify the committed revision. Platform consumers, release
preparation, npm integrity/provenance/readback and deployed Pages are separate
required delivery gates; their records live in GitHub Actions and the release.
Local results alone do not establish publication.

## Design basis

Themes own the document and favicon policy. Core continues to publish assets and
resolve URLs, while the optional share-image package owns social previews.
The shared theme helper resolves sources on Node; browser models contain only
public presentation data and resolved icon links. This avoids competing metadata
options and keeps local inputs out of serialized customization.

Primary references:

- [HTML icon selection and attributes](https://html.spec.whatwg.org/multipage/links.html#rel-icon)
- [Node 22.12 file reads and file URLs](https://nodejs.org/download/release/v22.12.0/docs/api/fs.html#fspromisesreadfilepath-options)
- [Node 22.12 File](https://nodejs.org/download/release/v22.12.0/docs/api/buffer.html#class-file)
