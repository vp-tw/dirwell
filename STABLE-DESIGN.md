# Stable implementation plan

The target release is `0.0.1`. Complete the accepted TODOs and their verification before publishing. Treat `@dirwell/*` as the only product. No announcement is in scope.

## Accepted boundaries

- No in-explorer preview feature in official themes. A disposable media-preview theme example may demonstrate extension points, without a maintenance or support promise.
- Controller input uses VueUse `useGamepad`. Physical-controller verification is not a `0.0.1` release gate by user decision; retain automated simulated-input regression evidence.
- Qualify Core filesystem/publication cost separately from each theme's data-loading, rendering and interaction cost. No single directory-size promise applies to every theme.
- Core/API/build integration ignore-file defaults are empty. CLI defaults to an optional cwd `.gitignore`; explicit configuration, including `[]`, overrides it.
- Official themes gain supported common customization; arbitrary layouts and behavior remain source-theme responsibilities.

## Selection: scenarios and contract

| Scenario                                                 | Expected result                                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| CLI runs from a repository and sources a child directory | cwd `.gitignore` applies rules relative to its own directory                                 |
| CLI runs without `.gitignore`                            | Continue; no invented hidden-file exclusions                                                 |
| Core/API or build adapter has no ignoreFiles setting     | No ignore discovery                                                                          |
| Config sets `ignoreFiles: []`                            | Disable CLI defaults                                                                         |
| Config uses relative/absolute ignore file paths          | Resolve file paths from execution cwd, independent of config file location                   |
| Shared ignore file lives elsewhere                       | `{path, baseDir}` explicitly scopes its patterns to the source tree                          |
| Explicit ignore file is absent/unreadable                | Fail before publishing or starting the server; only `optional: true` tolerates absence       |
| Multiple files use negation                              | Concatenate files in configured order within each base; deeper scopes override parent scopes |
| Ignore rule excludes a parent directory                  | Do not traverse it; negating only a descendant cannot reopen the parent                      |
| Glob include matches an ignored entry                    | Entry remains excluded; include is a selector, not an access/ignore bypass                   |
| Glob exclude matches an unignored entry                  | Glob exclusion wins                                                                          |
| Live ignore file changes                                 | Subsequent reads use current rules; native links and byte access obey selection              |
| Source/base has a filesystem path alias                  | Static and live agree after canonicalizing filesystem bases                                  |

Use Git-style syntax via the `ignore` package, not glob parsing. This is explicit ignore-file selection, not a Git index/worktree query: tracked files are not exempt, nested ignore files are not discovered automatically, and global Git settings are not loaded.

```js
import { defineConfig } from "@dirwell/cli";
export default defineConfig({
  ignoreFiles: [".gitignore", { path: "/shared/publication.ignore", baseDir: "./downloads" }],
  build: { exclude: ["drafts/**"] },
  server: { exclude: ["drafts/**"] },
});
```

Mode-specific `build.ignoreFiles` / `server.ignoreFiles` override the shared list. CLI `--ignore-file` replaces configured lists and is repeatable; `--no-ignore` explicitly clears them. Both flags together are an error. Core `resolveIgnoreFiles(files, cwd)` allows a host to resolve paths before its execution context changes.

## Publication: scenarios and contract

| Scenario                                               | Expected result                                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Missing/empty dedicated output                         | Build succeeds without force                                                                          |
| Output has a recognized Dirwell ownership marker       | Routine rebuild succeeds without force                                                                |
| Nonempty output has no valid marker                    | Explain replacement scope and require `--force` / `-f` or API `outputPolicy: 'replace'`               |
| Output is source, a source ancestor, a file or symlink | Reject even with force; check physical containment as well as lexical paths                           |
| Rendering or metadata fails                            | Previous output remains intact                                                                        |
| Installing the new output fails                        | Restore previous output; if restoration also fails, retain backup and report its exact recovery path  |
| Dry-run                                                | Report selected paths and planned directory pages; do not copy, render, create directories or publish |
| Source index occupies a page name                      | Report the selected explorer entry or skipped directory page                                          |

The marker is `__dirwell/ownership.json`, beneath the already reserved source-root namespace. It proves output provenance by convention, not a security boundary against a hostile local actor. Publication uses a staged sibling and a rollback backup; it is not a cross-directory transactional filesystem snapshot and may have a brief missing-path interval. Concurrent builders targeting the same canonical output are rejected by an exclusive sibling lock. Force does not bypass the lock. A crashed build may leave a stale lock; remove it only after establishing that its owning process has stopped. Trusted user callbacks may perform their own side effects; dry-run guarantees concern Dirwell's filesystem writes.

## Theme customization: purposeful implementation sequence

| User scenario                              | Design responsibility                                                                        | Acceptance                                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Translate UI and accessible names          | Partial labels with English fallback, document language, locale and timezone inputs          | Plain/Ledger/Crosswave visible strings, errors, pagination and dialogs use the selected labels; SSR and client formatting agree with the stated policy |
| Use a project identity and brand           | Small theme inputs and documented CSS tokens; header/footer source hooks for layout          | Title/identity/styles survive navigation and live updates; no compiler required for supported simple changes                                           |
| Show a compact listing with chosen columns | Typed column visibility/order policy, separate from file facts                               | Hide/reorder optional columns without losing primary link, keyboard navigation or narrow-screen layout                                                 |
| Add copy/download/custom row actions       | Separate action region outside the file anchor; source snippets/slots for arbitrary behavior | No nested interactive controls; mouse/keyboard/touch actions do not trigger folder navigation; copy failure is visible                                 |
| Show descriptions/checksums/badges         | Public JSON enrichment, independent of theme-specific rendering                              | Same annotations reach static/live output and revisions; no private source/stat data leaks; a release-download example demonstrates use                |

For each scenario: specify API and defaults, add one runnable example, implement, then verify rendered SSR/native fallback, rich navigation, live refresh, keyboard focus and mobile layout. A scenario is complete only after all affected modes pass. Theme inputs must remain optional, and Plain/Core must not acquire framework, image or compiler dependencies.

## Work record

- Delivered in the publication controls PR: nested CLI configuration validation and typed `defineConfig`.
- Delivered in the publication controls PR: shared ignore-file selection for Core, live service, CLI and build adapters.
- Delivered in the publication controls PR: output ownership, explicit force, rollback, exclusive output locks and dry-run reports.
- Delivered in [the customization PR](https://github.com/vp-tw/dirwell/pull/79): the five theme scenarios, public annotations, static file URL mapping and retry/search controls. Verification includes 206 Node tests, nine packed consumers, the installed release-download recipe, translated desktop/mobile action journeys, paired Svelte/Vue source actions and exact-head platform/browser CI.
- Delivered in [the browsing PR](https://github.com/vp-tw/dirwell/pull/80): shareable directory controls, History selection/scroll, complete failed-target recovery, malformed-snapshot rejection, skipped-parent native navigation and measured Crosswave windows. Acceptance passed: 206 Node tests, 25 browser scenarios, nine clean packed consumers, types/lint/format, subpath site build and the packed benchmark in [BENCHMARKS.md](BENCHMARKS.md); all 23 exact-head CI checks passed.
- Delivered in [the configuration validation PR](https://github.com/vp-tw/dirwell/pull/81): direct Core/Server/build-adapter validation, closest-key diagnostics and host-field projection. Acceptance passed: 212 Node tests, 21 Chromium scenarios, nine clean packed consumers, types/lint/format, subpath site build and all 23 exact-head CI checks. Deployed API/support readback passed.
- Remaining: discovery/support policy, strict CSP/access recipes, integration/device evidence and the release-candidate proof.
- No release has been dispatched and package versions have not been advanced.

## Large Crosswave directories

The packed-theme baseline at 10,000 entries renders all 10,000 Crosswave rows. Local Chromium at 4× CPU took about 2.2–2.5 seconds to filter and 4.7–4.8 seconds to clear, versus roughly 0.1 seconds for Ledger's measured window. These are diagnostic samples, not production budgets.

Keep the complete coherent data contract, but window Crosswave's DOM above 500 visible rows. Measure row heights, render an overscanned window in a bounded scroll region on desktop/mobile, reserve the actual footer height, preserve total/position semantics, and scroll/focus logical keyboard or controller selections into that window. Native SSR and no-JavaScript pagination remain unchanged. Acceptance covers 10,000 long names, custom columns/actions, desktop/mobile resize, scroll coverage, End/Home/filter/category, native pagination, and lifecycle cleanup. Data blocks still do not reduce total client memory.

## View state and recovery

Scenarios: share a filtered directory with a new visitor; open a folder then return with Back/Forward; preserve useful controls during live updates; recover a failed folder request without changing the successful view.

Contract: share directory query with `dw.q`; Ledger adds `dw.sort`, `dw.types`; Crosswave adds `dw.category`. Keep host/native `page` and other query parameters. Update the current history entry without adding an entry for every keystroke. New folder navigation starts an empty query with the theme's defaults. Back/Forward restores that history entry's query, sort/types/category, selected logical ID and scroll. Refresh/fresh tabs apply URL controls; selection and scroll remain local history state. Appearance preferences remain separate. Plain ignores these enhancement parameters and preserves native pagination.

Validation: reject unsupported sort/category/type values by falling back to current theme defaults; cap shared queries at 4,096 characters; restore only validated inert values. A removed/filtered selection yields the first usable row. Save view state before leaving; commit navigation history before replacing the model. If history mutation is unavailable, keep native links usable and preserve the existing view. Failed enhanced navigation retains the previous model/address; retry targets the failed request. Back-load failures return the address to the usable committed view and provide the failed native target.

Acceptance: both rich themes, static and live, folder/Back/Forward, refresh/shared fresh context, encoded names, selected-row focus, narrow-screen scroll, missing files, failed/slow/superseded snapshots, disabled history mutation, stale manifests and SSE reconnect. Native/no-JavaScript links remain valid.

## Direct API configuration validation

CLI validation does not protect JavaScript callers of Core, Server or build adapters. Validate recognized option keys and value shapes at each public boundary before publication locks, file writes or sockets. Keep custom theme objects extensible: verify required `name`/`render` and known contract fields, without rejecting their private extension fields. Trusted callback bodies remain executable host code; validate their documented results before publication.

Scenarios and acceptance:

- A misspelled `exclude`, nested sort key, listing strategy/size or live key fails with its complete option path and a likely correction. Invalid booleans and enum values cannot silently use defaults.
- Core generation rejects invalid configuration before creating a new output or changing an existing marked output. DirectoryService rejects invalid configuration before reading its root.
- Build adapters reject unknown config/sort/symlink/listing keys before publication; typed object config is checked immediately and callback factories remain lazy.
- Server validates its own expanded option set, then passes only DirectoryService fields to Core. The Node startup helper validates `host`/`port` and strips them before creating the handler; an invalid port never opens a listener.
- Valid async metadata/annotation providers, custom theme fields, source wrappers and listing-policy callbacks continue to work. Listing callback results reject unknown nested keys as well as invalid sizes.

Prefer explicit runtime checks against key maps checked with TypeScript `satisfies Record<keyof Options, true>`. Avoid a new schema dependency for the small Node-side configuration surface. Keep transport-data validation separate from configuration validation and preserve existing theme-factory validation.

## Package discovery and first-task proof

Scenarios: arrive on one npm package; copy its complete smallest example; see Ledger on the website and reproduce that interface; choose local browsing, static publication or app integration without guessing a package.

Each README supplies the required install list, script/file names, an expected result, Node requirement and absolute guide. Package homepage metadata points to the matching guide. Isolated npm consumers execute code extracted from each README. Unpublished sibling artifacts are resolved through same-version tarball overrides; unused family packages are not installed. This proves the local candidate's instructions and dependency graph, not public registry installation. Registry tags, README rendering and immutable integrity remain release follow-up.

The website pairs the Ledger preview with its CLI/theme install and live command, retains the minimal Plain commands, provides three task links and one theme capability matrix. Reuse the existing design, preserve native navigation and verify desktop/mobile wrapping and guide destinations.

## Private downloads and strict CSP recipe

Use an application-owned session resolver and a fixed approved root. The outer application gate covers HTML, listings, blocks, theme assets, bytes and SSE; Dirwell's `authorize` repeats the same root capability check during polling. An allowed parent listing exposes selected child names, so isolate tenants/roles with separate approved roots rather than treating the hook as row redaction. No identity provider, cookie issuer or production session store is added.

Compose a fresh response nonce after rendering trusted explorer HTML, apply it to script/style elements, and send a nonce/strict-dynamic script policy. Keep inline style attributes explicitly allowed for measured row positioning; that permission does not allow inline scripts or event handlers. Browse documents use private/no-store and do not reuse pre-nonce validators. JSON/assets/byte streams retain their transport, and active files download. The host owns CSP and session policy; no general HTML sanitizer or revoked-download guarantee is implied.

Acceptance: unauthenticated/expired requests cannot read any route surface, range or conditional response; selected approved names/bytes work after login; aliases cannot leave the approved root; SSE closes after revocation. Both rich themes hydrate, filter, navigate/back and refresh under CSP without script/style violations. Verify independent styling/head assets through the existing typed renderer asset contract. Preserve Plain's minimal default.
