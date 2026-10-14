# Stable readiness from the user's point of view

This backlog follows a user from discovering Dirwell to maintaining a deployed explorer. Stable should mean that users can choose the right package, complete the advertised task, predict publication and access boundaries, and customize common needs without replacing an entire theme.

Audited on October 14, 2026 against the current main checkout, the published `0.0.1-alpha.1` tarballs for Core/CLI/Ledger/Crosswave, npm registry tags, and the live homepage, theme guide and API reference. This is a source and task-path audit with two focused runtime probes, not a new full browser/device qualification or customer study. The scenarios below are plausible needs, not measured adoption.

Implementation is authorized through auto development. Treat the SDK family as the only product; user-facing work covers the current SDK and needs no announcement.

## How to use this backlog

- **G — Release gate:** fix or qualify the concrete problem before stable.
- **D — Contract decision:** decide and document the supported behavior before freezing the API. A feature can be explicitly deferred; shipping every proposal is not a release gate.
- **F — Follow-up candidate:** useful expansion with an identified user intent, but insufficient evidence to delay stable by itself.
- **Confirmed:** present in current code, documentation or a focused execution. **Proposed:** an improvement inferred from the scenario. **Unqualified:** the required user-path evidence is absent; this does not establish a defect.

The accepted implementation plan is [STABLE-DESIGN.md](STABLE-DESIGN.md). Publish `0.0.1` only after the accepted TODOs and validation are complete.

All checkboxes are deliberately open. They represent this backlog's acceptance criteria, not a statement that existing capabilities are missing.

## User intents and entry points

| Entry / user                              | What the user wants                                                   | What success means                                                   | Relevant work |
| ----------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------- |
| npm / developer trying a tool             | Open a folder immediately                                             | One command, clear URL and graceful stop                             | A1, A2, B3    |
| npm / API consumer                        | Generate a listing in an existing script                              | Copyable imports, exact install list, usable types                   | A1, A3, B1    |
| GitHub / evaluator                        | Decide whether Dirwell fits a download/archive site                   | Honest feature matrix, live examples, supported scale                | A2, D1, D2    |
| Website / person seeing Ledger            | Reproduce the interface shown in the demo                             | Commands produce the selected theme, not an unexplained different UI | A2, A3        |
| Maintainer publishing artifacts           | Publish only approved files                                           | Selection is visible and mistakes fail before publishing             | B1, B2, B3    |
| Existing-site maintainer                  | Add a browser without duplicating CDN files or replacing source pages | Independent file/page URLs and understood output ownership           | B4, B5        |
| Brand/theme consumer                      | Change labels, colors, footer, icons and columns                      | Small supported options before a source compiler is needed           | C1, C2, C3    |
| Theme developer                           | Add actions or rich entry annotations                                 | Typed public data and accessible extension points                    | C3, C4        |
| Non-English audience                      | Use translated controls, dates and share images                       | Correct language, formatting and glyphs                              | C1, C5        |
| Download-site visitor                     | Preview, copy a link or deliberately download a file                  | Clear safe actions with keyboard/mobile parity                       | C3, E3        |
| Archive visitor                           | Search across folders and share a useful view                         | Clear search scope, stable URL and restorable context                | D2, D3        |
| Large-directory operator                  | Handle many files on slower devices                                   | Qualified bytes, memory, responsiveness and fallback                 | D1, D2        |
| Node application developer                | Mount an authenticated live explorer                                  | Names, bytes, caches and live events obey one access policy          | E1, E2        |
| Build-tool consumer                       | Keep output current in dev/watch/CI                                   | Executed host support and clear failure/recovery                     | E4            |
| Keyboard/mobile/assistive-technology user | Browse without a mouse or powerful client                             | Useful native fallback, focus and announcements                      | D4, E5        |

## Batch A — Discovery, installation and adoption

### A1 · G · Make every npm package independently usable

- [ ] **Intent:** land directly on Core, a theme, Server or an integration package and complete its smallest task.
- **Confirmed gap:** the published Core README describes contracts but has no complete generation example. Theme READMEs begin with framework internals and factory calls rather than an install-and-run path. Their `../theme-authoring/README.md` link depends on repository layout and is not an appropriate npm-page documentation link. The inspected registry metadata points to the root GitHub README rather than the matching guide.
- **Change:** add purpose, exact package installs, one complete example, expected result, Node requirement and absolute guide links to each of the nine package READMEs. Keep advanced internals after the first task.
- **Acceptance:** exercise each package's quick start in a clean consumer folder using the release-candidate tarball; inspect its packed README and public npm rendering after publication. Verify documentation links from npm, not only GitHub. An absent registry `readme` field alone is not proof that npm fails to render a README.
- **Evidence:** [Core README](packages/core/README.md), [Ledger README](packages/theme-ledger/README.md), [Crosswave README](packages/theme-crosswave/README.md), their published tarballs and registry metadata.

### A2 · G · Align the promise, demo and first command

- [ ] **Intent:** see the searchable Ledger preview on the website and reproduce it.
- **Confirmed friction:** the homepage features Ledger, while its first command starts Plain. The page labels Ledger optional, so this is an expectation gap rather than a false claim. Nine packages and three themes still require several decisions before users know which combination they need.
- **Change:** provide three task paths: browse locally, publish static downloads, integrate in an app. Pair Plain and rich-theme commands with their actual output. Add one theme capability matrix covering search scope, sorting, previews/actions, customization, JavaScript and scale boundaries.
- **Acceptance:** from npm, GitHub and the website, a reader can reach a complete command for their intended task without guessing a package. Following each command produces the interface pictured beside it.
- **Evidence:** [README](README.md), [homepage](docs/src/pages/index.astro), [getting started](docs/src/content/docs/getting-started.md), [theme guide](docs/src/content/docs/themes.md).

### A3 · G · Coordinate stable tags, examples and support policy

- [ ] **Intent:** install without knowing release-channel terminology and keep a working installation reproducible.
- **Confirmed release state:** inspected npm packages have `latest: 0.0.1-alpha` and `alpha: 0.0.1-alpha.1`; the default tag currently selects a different CLI contract. This is the current prerelease state, not evidence that a stable release has failed. Public examples intentionally use `@alpha` today.
- **Change:** define the first stable version, package compatibility policy and supported Node/host range. Publish and verify all required packages before switching default commands and guides. Move the active SDK guide to a durable URL and preserve `/sdk-alpha/` links. Use durable product terminology.
- **Acceptance:** clean untagged CLI/Core/theme installs resolve the intended stable family; exact-version installs also work. Verify `latest`, dependencies, types, provenance, docs and examples after publication. Document prerelease use separately.
- **Evidence:** [package manifests](packages/core/package.json), [support guide](docs/src/content/docs/support.md), [SDK guide](docs/src/content/docs/sdk-alpha.md), current registry readback.

## Batch B — Predictable configuration and publication

### B1 · G · Reject misspelled nested configuration keys

- [ ] **Intent:** exclude private or irrelevant files and trust a successful command.
- **Confirmed defect:** a temporary fixture with `export default { build: { exlcude: [".env"] } }` builds successfully and copies its dummy `.env` into output. The CLI validates top-level keys but spreads nested build/server objects without rejecting unknown keys. This probe used fixture text only; it does not establish a real credential leak.
- **Change:** validate recognized nested options and value shapes at public CLI/API boundaries. Report the full option path and a likely correction. Offer a typed `defineConfig` or documented `@satisfies CliConfig` path without importing integrations' different configuration contract.
- **Acceptance:** misspelled `build.exclude`, `server.exclude`, listing and theme option keys fail before output replacement or socket creation. Invalid nested types fail clearly. JS and TS users receive usable completion; valid callbacks/hooks remain supported.
- **Evidence:** [CLI config loader](packages/cli/src/index.ts), [core options](packages/core/src/model.ts). Runtime probe executed against current built SDK output.

### B2 · D · Define an explicit hidden-file and ignore policy

- [ ] **Intent:** publish a folder without accidentally including `.env`, `.git` or local tooling; alternatively, deliberately publish hidden files.
- **Confirmed behavior:** selection supports dot paths and does not apply a hidden-file or `.gitignore` preset. With no selection rules, the dummy `.env` in the probe is copied. This is current selection semantics, not a promise that a project folder is safe to publish unchanged.
- **Recommendation:** use explicit ordered `ignoreFiles`: API defaults to `[]`, CLI defaults to an optional cwd `.gitignore`, and config can replace or disable it. Keep glob selection and Git-style rules distinct. See the accepted design for bases, precedence and missing-file handling.
- **Acceptance:** specify and test hidden paths, descendants, include/exclude precedence, ignored symlink targets and intentional overrides. The user can preview which files will be published. Choose the default before stable rather than changing it later without notice.
- **Evidence:** [selection implementation](packages/core/src/filters.ts), [generator](packages/core/src/generator.ts).

### B3 · G · Make output replacement and selection reviewable

- [ ] **Intent:** publish into the correct folder and understand what will be copied, skipped or removed.
- **Confirmed friction:** build prints only `Built <output>`. Core stages generation and then removes the previous output before renaming the new tree. Output ownership is documented, but the basic command does not preview selection or identify an existing unrelated target tree.
- **Change:** add a useful build summary and a dry-run/plan path with source/output, theme, counts, exclusions, skipped pages and replacement scope. Decide an explicit CLI policy for non-owned nonempty output; preserve a deliberate replacement option. Qualify final-swap recovery rather than calling the whole operation atomic.
- **Acceptance:** a plan does not mutate files; a failed render retains the prior build; an unrelated output directory is handled according to the stated policy. Exercise final rename failure and concurrent-build handling before claiming recovery guarantees.
- **Evidence:** [CLI build path](packages/cli/src/index.ts), [generator publication](packages/core/src/generator.ts), [deployment guide](docs/src/content/docs/deployment.md).

### B4 · D · Separate explorer URLs from file URLs

- [ ] **Intent:** publish listing pages while leaving large files on an existing CDN.
- **Confirmed limitation:** `mirror: false` avoids copying files but keeps generated native file links. The probe produces only `index.html` with a `public.txt` link and no corresponding file. That is valid when files are supplied separately, but `mirror: false` alone is not a working remote-file deployment recipe. Static `GenerateOptions` has no independent file URL callback; Server has `fileHref`.
- **Recommendation:** establish an encoded logical-path file URL hook or file-base option for static generation, independent of directory/page URLs. Include the CDN/no-copy recipe. Preserve filters and unavailable-link handling.
- **Acceptance:** root and nested pages link to external files while navigation, data, metadata and assets remain on the explorer host. Cover spaces, Unicode, `#`, `%`, aliases and unavailable targets; selected-file copying stays optional.
- **Evidence:** [core options](packages/core/src/model.ts), [server options](packages/server/src/index.ts), [deployment](docs/src/content/docs/deployment.md), runtime no-mirror probe.

### B5 · G · Exercise existing-page and nested-host journeys

- [ ] **Intent:** add an explorer to a site that already contains `index.html`, or deploy under a prefix.
- **Confirmed behavior needing clearer guidance:** the resolver uses `_dirwell.html` when a source index is occupied, and omits the explorer page when both names are occupied. Existing pages are intentionally preserved; the user still needs an exact explorer entry URL and an explanation of skipped directories.
- **Change:** show the final entry URL and skipped-page reasons in build output. Provide complete HTTP deployment recipes for a domain root, GitHub Pages prefix, existing CDN tree and Plain `file://` use. State rich-theme HTTP requirements.
- **Acceptance:** direct child entry, refresh, breadcrumbs, search result, pagination, file download and assets work in each supported recipe. Include both occupied filenames and custom `outputName: null`; do not infer a navigation defect without executing it.
- **Evidence:** [defaultOutputName](packages/core/src/generator.ts), [Plain navigation](packages/theme-plain/src/index.ts), [deployment](docs/src/content/docs/deployment.md).

## Batch C — Customization that does not require a fork

### C1 · D · Expose labels and locale as theme inputs

- [ ] **Intent:** publish for a non-English audience or adjust labels without replacing controls.
- **Confirmed limitation:** official documents use `lang="en"`, controls/errors are hardcoded English and date/name formatting uses the environment's locale. The i18n example owns a custom renderer; it is not official-theme label configuration.
- **Recommendation:** add document language, partial labels with defaults, locale and date/time-zone policy to official themes. A language picker is optional; configurable language is the contract worth deciding first.
- **Acceptance:** translate visible text, accessible names, loading/errors, pagination and dialogs in all three themes. SSR and hydrated formatting follow a stated policy. Changing locale preserves keyboard/IME behavior and does not require the authoring compiler.
- **Evidence:** [Ledger component](packages/theme-ledger/src/Ledger.svelte), [Crosswave component](packages/theme-crosswave/src/Crosswave.vue), [shared formatters](packages/shared-theme/src/records.ts), [Plain](packages/theme-plain/src/index.ts).

### C2 · D · Offer a small stable branding and appearance surface

- [ ] **Intent:** change a site title, logo, footer, typography or accent while keeping official behavior.
- **Confirmed limitation:** Ledger's factory options contain only `title`; Crosswave adds fixed color presets, categories and controls. Plain has separate attribution options. Header/footer slots exist, but using them requires paired source compilation. Rich-theme HTML/style ownership also makes favicon and strict CSP integration a custom-renderer concern.
- **Recommendation:** agree on shared project identity and documented CSS tokens, plus a safe document asset/head extension. Keep advanced layouts in source wrappers. Choose supported external styles or CSP hashes/nonces rather than recommending weaker policies by default.
- **Acceptance:** a small plain configuration changes common branding without Svelte/Vue source compilation. Theme switching retains project identity. Document which tokens/head extensions are stable and qualify an example strict CSP configuration; preserve Plain's minimal default.
- **Evidence:** [theme factories](packages/theme-ledger/src/index.ts), [Crosswave options](packages/theme-crosswave/src/index.ts), [Plain project](packages/theme-plain/src/theme-project.ts), [authoring contract](packages/theme-authoring/README.md).

### C3 · D · Add accessible row actions and column controls

- [ ] **Intent:** add copy-link, copy-path, download or a custom action, and hide/reorder columns.
- **Confirmed limitation:** row customization is inside the official file link and explicitly forbids nested interactive controls. It cannot safely provide an independent button there. Columns and timestamp dialogs are owned by the theme rather than configuration.
- **Recommendation:** define a separate typed action region outside the primary link, column visibility/order/format hooks, and opt-in built-in copy/download actions. Avoid making arbitrary client callback serialization part of CLI config; source hooks may remain necessary for custom behavior.
- **Acceptance:** primary navigation, row selection and actions work separately with mouse, keyboard and touch. No nested links/buttons. Copy uses the intended public URL/path, reports failure, and unavailable entries remain unavailable. A download action states static-host versus Node-header limitations.
- **Evidence:** [row contract](packages/theme-authoring/README.md), [Ledger rows](packages/theme-ledger/src/Ledger.svelte), [Crosswave rows](packages/theme-crosswave/src/Crosswave.vue).

### C4 · D · Define public entry annotations before themes depend on them

- [ ] **Intent:** show release versions, checksums, descriptions, badges or external documentation next to files.
- **Confirmed limitation:** public records provide filesystem/navigation facts plus theme-derived `presentation`. The theme hook receives projected facts, but there is no documented consumer-level async enrichment pipeline or standard sidecar manifest. Custom renderers can implement more; that does not make it easy for official-theme consumers.
- **Recommendation:** evaluate a public-entry enrichment hook/sidecar format reused by build and server, with typed JSON values and documented precedence. Keep private stat/source paths out of client records. Treat display names, search fields and metadata as separate policies.
- **Acceptance:** a release-download example adds a checksum and description without a theme fork; projection validation rejects unsupported data; filters, revisions, search and live updates reflect the chosen annotation contract. Specify synchronous versus asynchronous timing and cost.
- **Evidence:** [ExplorerTheme.entryData](packages/core/src/model.ts), [public projection](packages/core/src/listing.ts), [theme page model](packages/shared-theme/src/page.ts).

### C5 · F · Support custom font coverage for share images

- [ ] **Intent:** generate a share image containing Chinese, Japanese or another unsupported script.
- **Confirmed limitation:** the image package deliberately fails when bundled fonts lack glyph coverage; documentation directs the user to a custom renderer.
- **Proposal:** expose a documented local font/custom renderer recipe or supported font injection, with clear missing-glyph errors. Avoid remote font fetching or mandatory CJK weight for normal installs.
- **Acceptance:** generate and visually inspect Latin and CJK examples, prove deterministic offline rendering, and document memory/output impact. Keep default examples theme-appropriate rather than assuming a CJK audience.
- **Evidence:** [share-image README](packages/share-image/README.md).

## Batch D — Search, scale and returning to work

### D1 · G · Qualify the SDK scale claim and fallback

- [ ] **Intent:** use a rich interface for a large archive on a slower phone or connection.
- **Confirmed limitation:** rich themes load complete directory data; blocks do not bound total loading. Ledger virtualizes after 500 rows; Crosswave renders filtered rows. The loader caps default total entries at 100,000. Existing benchmark notes do not all measure the current SDK themes, so they are not sufficient proof for the new SDK themes.
- **Change:** benchmark current packed Plain/Ledger/Crosswave at representative sizes and define supported limits. Measure initial HTML, total transfer, parse/hydration, memory, search/sort and navigation under throttling. Expose a loading-limit/fallback policy if needed. Progressive/query loading is a separate design choice, not an assumed fix.
- **Acceptance:** publish reproducible workloads and budgets; demonstrate useful native pagination when data is too large, unavailable or invalid. Pick whether Crosswave needs windowing from measurements. Explain HTML pages, data blocks and rendered rows separately.
- **Evidence:** [support limits](docs/src/content/docs/support.md), [listing loader](packages/core/src/client.ts), [Ledger virtualization](packages/theme-ledger/src/Ledger.svelte), [benchmarks](BENCHMARKS.md).

### D2 · D · Make search scope and cost configurable

- [ ] **Intent:** find a file anywhere, limit search to a folder, or avoid building/downloading an archive index.
- **Confirmed limitation:** Ledger offers static archive search; live mode does not. Crosswave is directory-oriented. Ledger's archive search fetches its manifest and all shards for each query, checks a 100,000-entry limit and displays at most 100 matches. Browser HTTP caching may reduce transfer, but there is no in-memory loaded-index reuse in this path. Ledger options do not expose archive-search enablement.
- **Recommendation:** expose search capability and scope visibly, with an off switch and bounded index reuse. Define name/path/annotation versus file-content search explicitly. Evaluate a host query provider for live/large archives after measuring the current path.
- **Acceptance:** users can distinguish directory from archive results and understand limits. Disabled archive search emits no unwanted search assets. Repeated queries reuse qualified data; changed builds/live data invalidate correctly. Live archive search may be explicitly deferred, but the UI/docs must not imply it exists.
- **Evidence:** [Ledger searchArchive](packages/theme-ledger/src/Ledger.svelte), [search publication](packages/core/src/generator.ts), [troubleshooting](docs/src/content/docs/troubleshooting.md).

### D3 · D · Decide view-state and shareable URL behavior

- [ ] **Intent:** open a result, return to the folder, or send a colleague the current filtered view.
- **Confirmed behavior:** folder navigation restores a directory model through history but resets Ledger query, selection and scroll on non-refresh navigation. That establishes a state reset, not a verified browser-history failure. Sort/category/search state has no documented shareable URL contract.
- **Recommendation:** define per-directory history state for query, sort/category, selection and scroll. Decide which parameters belong in a shareable URL and how native pagination interacts with them. Preference persistence and shareable state are different concerns.
- **Acceptance:** test folder → file/folder → Back/Forward, refresh and a fresh-tab shared URL in both rich themes. Preserve state only according to the chosen policy; cover missing files and live changes without losing usable focus.
- **Evidence:** [Ledger navigation](packages/theme-ledger/src/Ledger.svelte), [shared navigation](packages/shared-theme/src/navigation.ts), [Crosswave](packages/theme-crosswave/src/Crosswave.vue).

### D4 · G · Finish the interruption and failure journey

- [ ] **Intent:** continue browsing after a network failure, expired listing revision or disconnected live feed.
- **Confirmed partial support:** themes show loading/error statuses and retain native links; the loader retries a stale listing once. Rich theme live-disconnection messages tell users to refresh. These mechanisms exist; their full user recovery flow remains to be qualified.
- **Change:** exercise explicit retry, cancellation, stale-build assets, offline transitions, rapid folder changes and recovery after SSE reconnect. Keep existing usable content while a refresh fails. Provide a visible action when an error tells the user to retry.
- **Acceptance:** failed navigation does not replace a good view or misreport its URL; obsolete responses cannot overwrite a newer selection. Native links/pagination remain reachable, retries recover without a restart, and status announcements distinguish empty, no-match, loading and error.
- **Evidence:** [listing loader](packages/core/src/client.ts), both rich components and [navigation](packages/shared-theme/src/navigation.ts).

## Batch E — Real deployment, access and release proof

### E1 · G · Demonstrate private-folder integration with honest boundaries

- [ ] **Intent:** mount Dirwell behind authentication without exposing protected child names or file bytes.
- **Confirmed boundary:** request authorization checks requested/canonical paths; allowing a directory exposes selected child names. Global filters are not identity-dependent row redaction. This is documented behavior, not proof that authorization is broken.
- **Change:** provide an executable authenticated mount example that scopes roots/filters appropriately, checks bytes and aliases, and explains cache identity/freshness. Include unauthorized and expired-session behavior for HTML, listing, page data, assets, files and SSE.
- **Acceptance:** denied roots/targets reveal neither protected names nor bytes under the supported recipe. Validate conditional/range requests and logout/expiry on a live subscription. If per-user row ACLs are promised, implement a coherent identity-aware listing contract first; otherwise explicitly defer them.
- **Evidence:** [Server README](packages/server/README.md), [authorization](packages/server/src/authorization.ts), [server options](packages/server/src/index.ts).

### E2 · F · Evaluate live archive queries and server scaling

- [ ] **Intent:** serve many concurrent users, frequently changing large folders, or multiple directories.
- **Confirmed limitation:** no shared response/snapshot cache or distributed invalidation; blocks can reread a complete directory. Filtered reads can traverse physical names to preserve descendant inclusion. SSE has per-directory polling and a default connection limit, not an unbounded service guarantee.
- **Proposal:** first measure cost with/without filters, aliases and concurrent subscribers. Then evaluate bounded revision caches, query providers or polling controls. Keep a trusted-local-root contract unless a separate threat model is implemented.
- **Acceptance:** report latency, filesystem reads, RSS and shutdown behavior for representative workloads; caches obey authorization and invalidation. Choose supported concurrency limits from evidence, not adapter availability.
- **Evidence:** [Core service](packages/core/src/service.ts), [live updates](packages/server/src/updates.ts), [Server README](packages/server/README.md).

### E3 · D · Define preview/download scope before advertising media use

- [ ] **Intent:** inspect an image/audio/video or obtain a file without leaving the explorer unexpectedly.
- **Confirmed boundary:** live safe-media transport serves selected formats inline and active formats as attachments. Official themes use native file navigation; HTTP transport support is not an in-explorer viewer. Static hosts own response headers.
- **Recommendation:** document the current behavior precisely. In-explorer previews are out of scope for official themes. An illustrative custom-theme example may demonstrate them without a long-term support promise. Qualify separate action regions and native download/open behavior. Defer active HTML/SVG/PDF/text rendering until its isolation policy is qualified.
- **Acceptance:** test preview and download on static and live paths, with large/ranged files and unsupported types. No accidental inline active content, no assumption that a cross-origin `download` attribute overrides host headers, and no mandatory preview dependency for Plain/Core.
- **Evidence:** [file transport](packages/server/src/files.ts), [Server README](packages/server/README.md), official theme row links.

### E4 · G · Make adapter and authoring examples runnable outside the repo

- [ ] **Intent:** add Dirwell to Vite/another build, or customize a theme without learning repository scripts.
- **Confirmed friction:** source wrappers are present, but many example READMEs run repository build scripts. Adapter availability has different watch qualifications; Farm's standalone non-module watch limit is already known and documented, not a new bug.
- **Change:** add clean consumer examples for the primary adapters and a complete source-authoring project with installs, compile, run, rebuild and shutdown. Publish a tested host/version feature matrix and keep experimental adapters visibly separate.
- **Acceptance:** build and change an ordinary source file in each claimed primary host; verify deletion/stale assets, output overlap and recovery. Run the authoring example using only published packages; demonstrate production SSR/client pairing and the documented HMR reset limits.
- **Evidence:** [integration README](packages/integrations/README.md), [authoring README](packages/theme-authoring/README.md), [wrappers](examples/authoring), [build-tools guide](docs/src/content/docs/build-tools.md).

### E5 · G · Qualify accessibility and physical-device essentials

- [ ] **Intent:** use native keyboard focus, a screen reader, touch, reduced motion or a controller.
- **Unqualified scope:** the current support guide explicitly leaves real screen-reader output, physical iOS and physical gamepad mappings unqualified. Existing automated keyboard, IME, browser and simulated-controller coverage is valuable but does not replace those paths.
- **Change:** execute the core browsing/search/sort/pagination/dialog/recovery journey with a real screen reader and iOS device. Check rich row virtualization announcements and focus, mobile long names, zoom, reduced motion and source action extensions. Keep controller qualification theme-specific.
- **Acceptance:** record device/browser/assistive-tool evidence and remaining limits. If physical gamepad support cannot be qualified, mark it experimental rather than blocking unrelated Plain/Ledger stable support.
- **Evidence:** [verification](VERIFICATION.md), [support](docs/src/content/docs/support.md), official components.

### E6 · G · Run a stable candidate proof, not only repository tests

- [ ] **Intent:** depend on the library with confidence that the published installation matches documentation.
- **Confirmed need:** current repository tests and prior platform proof do not establish the correctness of a future stable tarball, registry tags or changed APIs. Dependency security notes explicitly require a fresh release-candidate audit and distinguish retained development findings from installed consumers.
- **Change:** maintain a release checklist tied to the exact candidate: packed public exports/types, runtime dependencies, Node/platform installs, primary user journeys, current-theme benchmarks, browser/device evidence, licenses/security, coherent package versions, registry/provenance and deployed docs.
- **Acceptance:** demonstrate clean npm consumers for CLI static/live, Core generation, custom options, a primary adapter, authenticated server and source authoring. After publication independently verify tags and package integrity, then smoke the public docs/examples. Do not call workspace overrides consumer fixes or turn known retained findings into a clean-audit claim.
- **Evidence:** [verification](VERIFICATION.md), [dependency security](DEPENDENCY_SECURITY.md), package manifests and release workflows.

## Implementation progress

- Foundation delivered in [the publication controls PR](https://github.com/vp-tw/dirwell/pull/78): nested CLI validation, typed config, shared ordered ignore-file selection, explicit output ownership/force, canonical containment, rollback, concurrent-output locks and write-free dry-run reports.
- Local qualification: 198 Node tests, checks/types, nine packed SDK consumers and Pages-prefix site generation passed. External ignore-file Rollup watch is exercised. Exact-head CI passed, including 18 platform/Node consumer jobs; the PR was merged and Pages deployment succeeded. Live documentation readback remains pending.
- Theme customization is implemented on the working branch under [the accepted design](STABLE-DESIGN.md): shared labels/branding/columns, independent actions, public annotations and static CDN mapping. Local acceptance passed: 206 Node tests, clean packed consumers and the release-download recipe, types/checks, docs generation, desktop/mobile customization, native fallback and paired source actions. This batch is not yet delivered. No package version has changed and no release has been dispatched.

## Suggested execution order

1. **Close installation and publication footguns:** B1, B3, B5, then A1/A2. Decide B2's default before editing quick starts.
2. **Agree on the stable customization contract:** C1–C4 and B4. Prefer small theme inputs, CSS tokens and a separate action region; keep full layout ownership in source wrappers.
3. **Qualify search, scale and continuity:** D1/D4, with D2/D3 decisions informed by measurements. Do not conflate blocks, pagination and virtualization.
4. **Prove integration and access journeys:** E1/E4/E5; apply E3's accepted preview boundary. Leave C5/E2 deferred unless the selected stable audience needs them.
5. **Release only against the candidate:** A3/E6, after the chosen contract decisions and release gates are satisfied.

## Acceptance of this audit

- Reviewed npm registry metadata and actual published README contents for four entry packages; the other five still need their release-candidate consumer path exercised under A1/E6.
- Read current product/docs, package APIs, official theme source, CLI loading, listing transport, publication and server boundaries. Inspected current GitHub issue/PR listings: no open issues or PRs were returned. Closed topics such as previews, copy actions, scale and Farm watch are context, not proof of current SDK feature parity.
- Reproduced nested config-key acceptance and no-mirror native-link behavior against the current built SDK in an isolated temporary folder with dummy files. Neither test touched a real secret or production output.
- Retrieved the live homepage, theme guide and API reference successfully. npm HTML browsing was unavailable through the web fetcher; tarballs and registry metadata supplied primary package evidence. Public npm link rendering remains an A1 acceptance check.
- Did not rerun the full test suite, browser journeys, performance suite, consumer security audit or physical-device checks for this audit. Items requiring those checks remain open instead of being described as regressions.
