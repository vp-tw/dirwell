# Stable implementation plan

The target release is `0.0.1`. Complete the accepted TODOs and their verification before publishing. Treat `@dirwell/*` as the only product. No announcement is in scope.

## Accepted boundaries

- No in-explorer preview feature in official themes. A disposable media-preview theme example may demonstrate extension points, without a maintenance or support promise.
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
- Implemented locally: the five theme scenarios, public annotations, static file URL mapping and retry/search controls. Verification includes 206 Node tests, nine packed consumers, the installed release-download recipe, translated desktop/mobile action journeys and paired Svelte/Vue source actions. PR delivery remains pending.
- Remaining: discovery/support policy, SDK/theme benchmarks, history/failure journeys, integration/device evidence and the release-candidate proof.
- No release has been dispatched and package versions have not been advanced.
