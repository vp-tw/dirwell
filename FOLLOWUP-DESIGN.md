# Custom fonts and live archive queries

Users should generate branded/CJK share images without replacing the renderer, and find an allowed file across a live root without downloading a browser-wide index. Auto development is authorized for these two follow-ups. Distributed caching, file-content indexing and automatic remote-font downloads are outside this scope. Qualify and release the synchronized family as 0.0.2 only after both slices pass.

## Custom fonts: share-image

Add an optional local font mapping for body/headline roles; a single supplied body font also supplies the headline unless explicitly overridden. Accept paths resolved from cwd and local file URLs. Read and validate bounded TTF/OTF bytes, then outline custom text with the same parsed Fontkit face so measurement and rendering consume identical bytes. Keep default presets, lazy optional dependencies and their PNG goldens unchanged. A byte digest participates in the bounded PNG cache; custom font objects are not retained globally.

The pinned resvg 2.6.2 API accepts font file paths, not an in-memory font API. Fontkit glyph outlines avoid mutable path rereads, temporary files and ambiguous family/style matching between measurement and rendering, without a dependency upgrade. Fontkit 2.0.4 provides glyph coverage, family names and shaping metrics. Sources: https://github.com/thx/resvg-js/blob/v2.6.2/index.d.ts and https://github.com/foliojs/fontkit/blob/v2.0.4/README.md.

Acceptance:

- Execute Latin and Traditional Chinese/Japanese fixtures in all three presets; PNG is 1200 by 630, visually legible, with complete glyph coverage and no clipping.
- Repeat identical input/fonts to prove identical PNG bytes. Change bytes at the same filename to prove cache invalidation; independent calls with different fonts never mix measurements or rendered faces.
- Invalid/missing/oversized fonts and unsupported collections/formats fail clearly. Missing glyph errors identify the code point and role. Unicode grapheme truncation and long strings remain bounded.
- No network/system fonts are read. No temporary font files are written; license/source provenance is retained for the test/example font, which is not included in runtime package defaults.
- Report fixture font size, render latency/RSS/output size; preserve packaged default consumer behavior and dependency isolation.

## Live archive queries: server and rich themes

Add opt-in bounded server search with query/limit/subtree options and explicit public JSON results. Scan fresh on each request; no response/index cache or watcher is required. Search filenames/logical paths, not file contents or private annotations. Share a small client query protocol with Ledger/Crosswave, preserving current-directory filtering and native file/result links. Plain retains its native browsing contract. Enable through Server/CLI configuration; default is off. Factory archive controls can hide the capability independently.

Acceptance:

- Root/subtree queries find nested allowed names and paths, including spaces, hash/percent and Unicode. Results have safe encoded directory/file links and deterministic ordering; no absolute filesystem paths enter JSON.
- Added/deleted/renamed files appear in fresh queries and in an open live-search UI within the documented refresh interval. Superseded/aborted responses cannot overwrite the latest query.
- Unauthorized roots/subtrees/files, excluded/ignored paths and unsafe/broken aliases are absent; denied children are not traversed. Canonical aliases do not duplicate results or cause cycles. Authorization is checked per request without cross-session caches.
- Query length, entry/directory scan budgets, result count and active requests are bounded. Budget exhaustion is an explicit error, not an incomplete archive presented as complete. Abort releases request capacity; failures are retryable.
- Both rich themes distinguish archive from directory search, provide loading/no-results/error/retry states, native result links, Escape/focus restoration and keyboard/mobile behavior. Disabling search adds no search requests/assets or scan.
- Measure 1k/10k representative trees, four concurrent queries and idle/active UI update behavior. Report latency, reads and RSS; do not claim an unbounded production capacity or transactional filesystem snapshot.
- Exercise packed APIs, CLI configuration, source wrappers, protected host integration and installed registry consumers before release.

## Qualification evidence (local candidate)

- Licensed Noto Sans TC source pinned to Google Fonts commit `3be1884c48c3e45b52ecc725676a08f87776373e`, renamed static subset 28,512 bytes, provenance/OFL in `test/fixtures/fonts`. Three CJK/Japanese/Latin presets produce readable 1200×630 images; default Latin images are byte-identical to extracted published 0.0.1. On this local Node process, three custom renders took 94 ms total; PNG sizes were 37,402/36,638/121,537 bytes and RSS reached 109 MB. These are workload observations, not capacity promises.
- Four concurrent local fresh queries, flat 100-file directories: 1k files took 140 ms unfiltered / 118 ms filtered, 10k took 2,361 / 1,471 ms. All returned 200 using `maxConcurrent: 4, maxEntries: 11000`; each enumerated 1,010/10,100 names and opened 11/101 directories. RSS snapshots rose from 68 MB initially to 192 MB after all runs (not peak heap or isolated per-request attribution). Filter excludes `**/report-99.txt`. The default 10k entry budget includes directories, so this 10k-file tree deliberately needs a higher explicit budget.
- Search canonicalizes output by publishing physical entries only; aliases are omitted and directory symlinks are never traversed. Selection streams directory names before bounded sequential descriptions; it does not download a client archive index. Concurrent filesystem mutations can disappear during stat and are skipped; the trusted-root contract does not provide a transactional or hostile-writer snapshot.
- Chromium browser tests exercised both themes at desktop and 390×844, typing, file create/rename/delete refresh, Escape, focus restoration and no page errors. Source-wrapper packaging includes the shared live-query helper; three-engine compatibility (21 checks) and nine packed consumers also passed, including both installed source wrappers, custom fonts and live queries. The authenticated host/CSP example passed query authorization alongside existing listing/file/SSE paths. Superseded queries and explicit search errors/retry were exercised in both rich dialogs. Exact candidate CI and registry readback remain required before delivery.
