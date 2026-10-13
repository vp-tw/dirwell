# Architecture

Dirwell has two execution paths: static publication and live Node HTTP serving.
Both use the same filesystem facts, public listing records and theme contract.
The active user-facing API is the `@dirwell/*` SDK; the root facade is retained for historical regression checks;
see [package responsibilities](PACKAGE_TRANSITION.md) and the
[SDK guide](docs/src/content/docs/sdk-alpha.md).

## Package boundaries

- Core selects filesystem entries, prepares safe links, projects public records
  and publishes static HTML/assets. It requires a theme and has no framework,
  config loader, watcher or image renderer dependency.
- Plain owns minimal native HTML, portable links and pagination. It has no
  runtime npm dependencies, browser JavaScript, fonts or default metadata assets.
- Ledger and Crosswave own their Svelte/Vue SSR and client state, DOM and
  lifecycle. Framework dependencies belong to those themes.
- Server owns live HTTP routes, authorization, headers, file transfer and optional
  shared SSE polling. Host adapters remain small Node/Express/Fastify bridges;
  Hono can forward its Request directly.
- CLI owns command/config loading and defaults to Plain from `0.0.1-alpha.1`.
  Explicit `--theme` or `config.theme` overrides that default. Other themes are
  installed separately. Core and integrated HTML keep explicit theme selection.
- Share-image, build integrations and theme authoring are optional capabilities.
  Source authoring compiles paired SSR/client components; it is not a server-mode
  filesystem cache or a generic frontend framework layer.

## Static publication

1. The caller supplies source/output paths, a theme and optional selection,
   sorting, URL, symlink, listing and metadata policies.
2. Core scans selected entries and classifies internal, excluded, outside-root,
   broken and cyclic symlinks.
3. It resolves generated filenames and plans pages before rendering, so URL
   decisions know which directories have explorer pages.
4. A per-directory listing policy independently chooses complete/paged HTML and
   complete/blocked public data. Themes must explicitly support pagination.
5. Theme and optional metadata provider render into a sibling staging tree.
6. A successful complete build replaces the dedicated output tree; failed
   rendering retains the previous successful output.

SSG stores runtime assets beside generated pages; MPA shares them through the
reserved `__dirwell/` output-root path. Source collisions with reserved paths
fail. Relative links are portable; base/html-base layouts are explicit choices.
Source files are mirrored by default, and existing source indexes are preserved.

Layout does not imply a particular DOM strategy. Plain's native pagination works
without JavaScript. Rich themes can load a complete compact listing for
full-directory search/sort; Ledger virtualizes large lists and Crosswave renders
its filtered rows. HTML pagination and data blocks do not make a live directory
scan constant-cost. The historical default-theme MPA/worker rule belongs to the
compatibility package, not this SDK contract.

## Live serving

`createExplorerHandler` returns an async Request/Response handler over a trusted
local root. Await creation before mounting it. `startExplorerServer` owns the
standalone Node listener and defaults to loopback, an ephemeral port and safe
media previews. Integrated file transfer is opt-in. The host owns shutdown when
using an adapter; standalone callers await `server.close()`.

Browse pages, page snapshots, listing manifests/blocks, theme assets, file routes
and update events share `mountPath`. Listing requests read/sort current directory
facts; they do not build an output tree. Complete live data is the default because
official rich clients require it. Explicit blocks remain available, with a fresh
read per block. Children deleted between enumeration and metadata reads are
omitted; permission and containment failures still propagate. Requests are not transactional filesystem
snapshots. Changed listing revisions return 410 and the client retries a fresh
manifest with bounded retries. Rich live updates commit complete coherent data
and preserve the active query.

Optional SSE shares one polling group per canonical directory. It rechecks each
subscriber's authorization, coalesces slow consumers and releases polling when
the last subscriber leaves. On-request data freshness does not require SSE;
Plain remains script-free and shows fresh data on navigation/reload.

There is no global HTTP response cache, retained historical snapshot, distributed
invalidation or filesystem watcher in this execution path. Pagination still
requires reading the directory; filtered selection can traverse physical names
through the tree. Live server has no archive search or build metadata provider.
Production-scale performance and adversarial concurrent filesystem replacement
are not qualified.

## Trust and HTTP policy

Themes execute trusted Node code and must escape source names before inserting
HTML. Node inputs include private machine paths; browser records must come from
public projection rather than spreading raw entries. Browser clients do not
traverse filesystems.

Requested and canonical target paths are authorized before validators or bytes.
Authorization is request-level, not child-row redaction. Scope roots/filters to
avoid exposing child names through an allowed parent. Responses default to
no-store; custom authorized policies cannot be public/shared caches.

Files stream with backpressure and cancellation, range GET and metadata HEAD.
Raster/audio/video may preview inline in standalone media mode. HTML, SVG and
other files download with attachment and nosniff. Broken/outside/excluded links
expose only declared target text, never outside-root bytes. Cycles remain visible
without recursive expansion.

## Configuration and customization

CLI discovers only native `dirwell.config.mjs` in the working directory, or a
module selected by `--config`. It exports `{theme, listing, build, server}` and
is executable trusted project code. Ordinary API/integration callers configure
options directly. No new config inheritance or TypeScript transpiler is required.

Official source wrappers use Svelte snippets or Vue slots through the optional
paired compiler. Production rebuilds need a fresh renderer/theme instance and
module import URL when replacing cached modules. Its loopback development server
supplies native framework HMR; file revision updates remain a separate SSE path.

The compatibility facade retains c12 configuration, default legacy themes,
watch/rebuild preview and daemon commands. Its existing adapters retain host
lifecycles. Shared core behavior is reused where qualified; legacy component
controllers and new framework templates remain separate APIs.

## Toolchain and evidence

The repository uses pinned pnpm/Vite+, strict TypeScript, Astro Starlight, Node
unit/integration tests and Playwright. Installed tarballs and registry consumers
are separate checks; platform qualification covers native OS/architecture/Node
combinations. See [verification](VERIFICATION.md), [support](docs/src/content/docs/support.md)
and [workspace releasing](WORKSPACE_RELEASING.md). A package export or common
bundler does not establish every host/framework lifecycle as supported.
