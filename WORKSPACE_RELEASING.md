# Releasing the Dirwell workspace

The nine official `@dirwell/*` packages share one version and a fixed Changesets group. `0.0.1` is the first non-prerelease family. The 0.0.x API may evolve; applications should pin a qualified version and upgrade the family together. Publication requires an explicit main-branch workflow dispatch with `publish=true`.

## Prepare a candidate

1. Finish accepted readiness items. Set all nine manifests to the same unused version, consume the corresponding Changesets, and record package/workspace change notes. Internal workspace dependencies must pack to that exact version. Stable releases use `latest`; alpha releases use `alpha`.
2. Commit and qualify the exact source with security/license checks, `pnpm check`, Node/browser/compatibility tests, packed consumers, isolated README programs and site generation. Primary hosts are qualified separately for build and watch behavior; adapters existing does not qualify every host.
3. After merge, dispatch `publish-workspace.yml` with the exact version and `publish=false`. This repeats the required checks and retains immutable verified tarballs without requesting a publication token. Inspect the source commit, manifest, integrity and proof before publishing.
4. Dispatch the qualified version with `publish=true` and `authentication=oidc`. All nine packages have their trusted publisher configured for this workflow. Preserve provenance and registry readback; never substitute another source or artifact when recovering a partial publication.

For local preparation, use `RELEASE_VERSION=0.0.1 node scripts/workspace-release.mjs prepare`, then `verify`. The release directory is `.workspace-release` by default. A different source requires a fresh `DIRWELL_RELEASE_DIR`; preparation does not overwrite existing verified bytes. `node scripts/verify-workspace-consumer.mjs .workspace-release` and `node scripts/verify-readme-quickstarts.mjs .workspace-release` exercise isolated installed artifacts. The platform workflow qualifies installed tarballs across 18 OS/architecture/Node combinations.

The release script rejects mixed versions, unknown/omitted packages, unresolved internal dependencies, unsafe filenames, altered bytes, out-of-order dependencies and incorrect source/event/ref. Publication order is Core, Plain, Server, Share Image, Integrations, Ledger, Crosswave, CLI and Theme Authoring.

## Publish and recover

After the committed release changes are qualified, dispatch the exact merged version with `publish=true` and the applicable authentication mode. Only the publish job has `id-token: write`; it publishes the verified tarballs with provenance and without package lifecycle scripts. OIDC publication uses no static npm secret.

Before its first write, the script looks up every exact package version. Matching SHA-512 bytes are skipped on a retry; conflicting bytes stop the entire attempt and require a new version. Missing packages publish in dependency order. Publication is not atomic across packages: a failure can leave a partially available family. Rerun failed jobs in the original run so they reuse its verified artifacts. Do not dispatch the same version from another source or rebuild tarballs during a retry.

Existing versions without the expected provenance or release-channel tag fail readback. Stable `0.0.x` versions publish to `latest`; alpha versions retain `alpha`. The workflow does not silently move a tag; standalone dist-tag changes have separate publisher permissions. No package is unpublished as a recovery action.

## Read back delivery

The workflow verifies each exact registry version, downloaded tarball integrity, release-channel tag, provenance source/workflow and package payload digest. It then installs the registry family, compares lockfile integrity, runs `npm audit signatures` and exercises the installed consumer. Only after those pass does it create the `@dirwell/workspace@<version>` GitHub release/tag (prerelease for alpha only) bound to the exact source commit. Registry/provenance propagation retries are bounded; a timeout is incomplete delivery, not successful publication verification.

Pages deployment remains separate. Current public examples are not proof of installed registry behavior. Preserve platform and browser limits, including pending physical iOS/screen-reader qualification, hostile filesystem mutation, distributed caches and production-scale performance.

Public default install commands switch only after the complete registry family passes verification. Physical iOS and screen-reader qualification remain documented pending paths; physical controllers are not a separate release gate.
