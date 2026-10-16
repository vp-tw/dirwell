# SDK workspace changes

The nine official `@dirwell/*` packages use synchronized versions. `0.0.1` is the first non-prerelease family; the 0.0.x API may evolve, so pin the version qualified by your application.

## 0.0.6

- Make readable, non-interactive size text the default in Plain, Ledger and Crosswave. Raw bytes continue to drive numeric sorting and remain available to custom themes.
- Keep exact bytes as an explicit publisher opt-in. Add only values that differ from the visible text; omit pointless disclosures and repeated byte counts.

## 0.0.5

- Expose browser-safe `@dirwell/core/format` helpers for independent themes; raw byte fields remain unchanged and formatting is optional.
- Apply shared binary-unit and automatic-precision defaults across Plain, Ledger and Crosswave. Add decimal/bytes, precision and locale options. Plain now defaults to readable units; choose `size.units: "bytes"` to keep exact-byte presentation.
- Show labeled symlink Target and Link sizes by default, with both/target/entry settings and native exact-byte disclosures. Keep unavailable targets distinct from zero and directory content totals.
- Add explicit `targetSize` sorting across build, live service, manifests and Ledger URL/History state. Existing `size` retains entry-byte meaning; non-comparable sizes follow numeric values in both directions, subject to folders-first.
- Preserve Ledger compact rows/sticky context and ship standalone source helpers for Svelte/Vue authoring. Directory aggregation, allocated disk space and transfer size remain separate opt-in proposals.

## 0.0.4

- Restore Ledger's compact inventory layout: 52px default desktop rows, aligned headings and cells, and natural growth for long names, link targets and custom actions.
- Keep directory context and desktop column headings together while scrolling. Measure wrapped headers, release oversized headers from sticky positioning, and retain gap-free native no-script column headings and pagination.
- Replace Ledger's legacy stylesheet plus SDK overrides with one complete stylesheet. Share configured column tracks between header and rows; keep the other themes' styling unchanged.
- Preserve keyboard-selected virtual rows through height measurements. Qualify narrow mixed Latin/CJK content, no-script navigation and sticky hit testing in Chromium, Firefox and WebKit.
- Synchronize all nine SDK packages at 0.0.4 with exact packed internal dependencies. No public API changes.

## 0.0.3

- Move directory URL policy into Core `routing.directoryUrls`, shared by static builds, Server, CLI and every theme. Default to explicit `folder/index.html`; support directory-index `slash` and file-first extensionless `clean` publication with coordinated resource and metadata bases.
- Remove Plain `portableLinks` and theme-side URL guessing. Third-party renderers consume resolved nullable directory links and the new directory/asset identity callbacks; CLI config owns routing at the top level.
- Preserve owned homepages with explicit `_dirwell.html` fallback and co-located native pagination. Reject source/page/resource conflicts without replacing the previous successful output, including forced homepage replacement, case/Unicode conflicts and clean same-stem downloads.
- Normalize authorized live GET/HEAD aliases with query-preserving temporary redirects. Keep literal `index.html` directory identities in clean mode and honor explicit null file mappings.
- Preserve WebKit History focus after mouse activation and Crosswave native no-script hit testing. Qualify 864 publication combinations, three-engine routing/regression, installed family consumers and deployment guidance; actual vendor host configurations still require qualification.

## 0.0.2

- Accept local body/headline TTF/OTF fonts for deterministic branded/CJK share images, with bounded reads, role-specific glyph errors and cache invalidation by font bytes. Preserve default PNG bytes and optional dependency isolation.
- Add opt-in bounded fresh archive name/path queries in Server and CLI, applying authorization and selection before traversal. Omit aliases, return explicit budget/overload errors and keep results request-local.
- Connect Ledger/Crosswave archive dialogs with debounce, visible-dialog refresh, cancellation, retry, keyboard focus restoration and mobile layouts; retain directory filtering and native links.
- Qualify licensed font fixtures, fresh query workloads, source exports, packed consumers and browser/OS contracts. Distributed caches and file-content search remain deferred.

## 0.0.1

- Validate direct Core/Server/CLI/build configuration and callback listing plans before initialization or output replacement, with complete paths and nearest-key suggestions.
- Keep explicit globs and ordered Git-style ignore files; CLI defaults to optional cwd `.gitignore`, while Core/configured adapters retain explicit empty defaults.
- Protect output ownership, require deliberate force for unrelated nonempty targets, retain canonical containment/locks/rollback and provide write-free selection reports.
- Support shared labels, language/direction/date settings, identity/CSS tokens, columns, independent actions and public JSON annotations; allow static file URLs independent of explorer URLs.
- Preserve shareable controls, History selection/scroll and successful views during failed/superseded navigation; measure/window both rich lists and keep native no-JavaScript pagination.
- Provide executable package/source/host/private-session/CSP recipes, qualified scales/device boundaries and durable SDK documentation. Official themes retain native file opening/downloads rather than embedded previews.
- Publish one verified nine-package family with exact dependencies, provenance and latest tags. Font injection and live archive/distributed-cache expansion remain separate follow-ups.

## 0.0.1-alpha.1

- Include minimal Plain in the CLI. `dirwell server <source>` and
  `dirwell build <source> --out <output>` no longer need an explicit theme.
  Core and integrated HTML still require one; rich themes remain separate.
- Discover native `dirwell.config.mjs`, allow `--config` overrides, and preserve
  explicit theme/config/default precedence. Add `plain`, `ledger`, `crosswave`
  shortcuts and resolve themes supplied through npm exec outside a project.
- Reject silently ignored legacy config files so migration cannot lose file
  selection rules; clarify that new and compatibility CLIs share a bin name.
- Respect `server.host`/`server.port` configuration, retain live polling settings
  when `--live` enables updates, and fail on flags belonging to the other mode.
- Keep live directories available when an enumerated child disappears before
  metadata reads. Preserve SSE subscriptions and permission/path failures.
- Default live listing data to one complete block, avoiding repeated scans for
  clients that need the whole directory; explicit block policies remain available.
- Retain immutable CSS/client resources and hashes per rich-theme instance;
  keep filesystem listings fresh and retain authorization before responses.
- Wait within existing bounds for registry packument/alpha-tag propagation,
  retaining source/provenance/integrity validation and never moving tags.
- Clarify SDK/compatibility documentation and preserve hidden browser-failure
  artifacts. Update local packed verification for synchronized subsequent alphas.

## 0.0.1-alpha

First nine-package SDK release: explicit core themes, minimal Plain, native
Svelte Ledger and Vue Crosswave, live HTTP/file/SSE serving, standalone CLI,
optional build metadata/images, build-tool integrations, and paired source
component authoring with local framework HMR. Registry payloads, provenance,
signatures and installed consumers were verified before release completion.
