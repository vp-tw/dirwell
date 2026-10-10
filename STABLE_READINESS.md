# Stable readiness

Dirwell remains alpha. This is a release decision checklist, not a promise that a stable release has been approved. The theme contract is a candidate for freezing after the changes below are verified; alpha peers still pin an exact version.

## Gates before a stable release

| Gate                            | Current evidence                                                                                                                                                                                                                                    | Completion condition                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme compatibility boundary    | Complete renderers, assets, prepared links, page metadata, theme-owned images and Ledger DOM hooks have types, examples, and consumer/behavior tests.                                                                                               | Review and explicitly freeze the supported public types, documented runtime hooks and upgrade policy. Keep internal virtual-list/worker protocols and Crosswave implementation hooks private.                    |
| Dependency security disposition | The frozen workspace reports seven advisories, including four high; a fresh alpha.12 npm consumer lock reports zero. Workspace includes docs/build dependencies and installed optional host peers. Existing consumer locks may resolve differently. | Resolve compatible locked-version updates or document reviewed reachability/exception decisions. Track [dependency audit resolution](https://github.com/vp-tw/dirwell/issues/56); no blanket audit suppression.  |
| Supported environments          | Full browser regression is Chromium. A bounded engine suite covers Ledger overrides, Crosswave folder/history and Plain no-script navigation in Chromium, Firefox and WebKit. Existing tests cover real primary build hosts.                        | State the minimum browser/version policy and supported OS/Node matrix, then verify those stated targets. Engine smoke is not full cross-browser parity, physical Safari/iOS, Windows or controller verification. |
| Stable distribution             | OIDC alpha publication, installed registry consumption, signatures/provenance and exact-source prerelease tags are verified. The workflow explicitly accepts alpha versions only.                                                                   | Approve the first stable version and compatibility promise; implement and test a stable publication/tag path before dispatching it. Current alpha automation is not a stable publisher.                          |

## Recommendations that need not block the theme contract

- The pinned `c12@4.0.0-rc.1` is a prerelease dependency; the registry's latest is also a 4.0.0 RC at this review. Prefer a suitable stable dependency when available, or record the exact-version test rationale. An RC label alone does not establish a defect.
- Add representative Windows CLI/config/watch and macOS coverage if those systems are in the eventual support promise. Symlink permissions and filesystem watching should have explicit limits. Do not infer platform parity from a Linux CI run.
- Keep experimental adapters, physical gamepad activation, optional previews and custom-theme localization outside the basic stable guarantee unless verified and explicitly promoted. Farm native watch is a documented experimental limitation, not an automatic stable-core backlog requirement.
- `project.name` and `metadata.siteName` serve different scopes; fixed image palettes and explicit CLI source paths are documented choices. These are not known defects requiring redesign.

## Evidence and reproducible checks

Run `pnpm check`, `pnpm test`, `pnpm test:browser`, `pnpm test:compat`, `pnpm build`, `pnpm site:build`, and `pnpm verify:package`. Publication still requires installed registry readback, cryptographic signatures/provenance, an exact-source tag and actual site verification, as described in [Releasing](RELEASING.md).

Run `pnpm audit --json` against the frozen workspace. Separately audit a new private consumer with an exact published version, using `npm install --package-lock-only --ignore-scripts --no-audit` followed by `npm audit --omit=dev --json`. These are dependency metadata checks; neither proves exploitable input reachability or the absence of every security flaw. Generated static sites do not run the workspace's Node dependencies.

The review baseline is the main source delivered by the [theme/example audit](https://github.com/vp-tw/dirwell/pull/55) and alpha.12 registry package, checked October 10, 2026. Live advisories, available versions and browser engines can change. Recheck them at the stable release candidate.
