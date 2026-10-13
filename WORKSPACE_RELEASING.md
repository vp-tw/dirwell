# Releasing the Dirwell workspace alpha

The new `@dirwell/*` family starts at exactly `0.0.1-alpha`, tagged `alpha`. Its nine official packages share one version. This procedure is separate from the legacy `@vp-tw/dirwell` release and its existing trusted publisher. The first-release change removes the nine `private: true` guards together. Publication still requires an explicit main-branch workflow dispatch with `publish=true`.

## Preparation without npm authentication

1. Commit the qualified source and synchronized manifests. Build with the repository's pinned toolchain, run `pnpm audit:dependencies`, `pnpm check`, `pnpm test`, browser/compatibility checks, `pnpm build`, `pnpm site:build` and `pnpm verify:package`.
2. Run `RELEASE_VERSION=0.0.1-alpha node scripts/workspace-release.mjs prepare`, followed by `RELEASE_VERSION=0.0.1-alpha node scripts/workspace-release.mjs verify`. Preparation creates `.workspace-release/manifest.json` and nine tarballs, recording the commit, packed metadata and SHA-512 integrity. Private artifacts can be prepared and tested, but cannot be published. Repeating preparation reuses the verified manifest and bytes; a different source requires a new `DIRWELL_RELEASE_DIR`, rather than overwriting the old release artifact.
3. Run `node scripts/verify-workspace-consumer.mjs .workspace-release`. This installs only the actual tarballs in an isolated consumer, then exercises all themes, static modes, CLI, live server/files and optional metadata/images. Real build-host tests execute separately in the repository suite. The platform workflow independently qualifies installed tarballs on 18 OS/architecture/Node combinations.
4. After merge, dispatch `publish-workspace.yml` with the exact version and `publish=false`. It repeats required checks and retains the verified artifacts. This path never requests an OIDC token or publishes. Any later publication change must be committed and qualified again before `publish=true` is used.

The release script rejects mixed versions, unknown/omitted packages, unresolved internal dependencies, unsafe filenames, mismatched metadata, altered bytes, out-of-order dependencies and incorrect publication source/event/ref. Packing uses pnpm's workspace dependency resolution; no development symlink is accepted as registry qualification. The official order is core, Plain, server, share-image, integrations, Ledger, Crosswave, CLI, theme-authoring.

## First-publication gate

The accepted bootstrap uses a one-day granular CI token for the actual `0.0.1-alpha` payloads, followed by OIDC. No staging placeholders are published. Browser login does not authenticate npm CLI. Never copy browser credentials or put token values in source, logs, artifacts or conversation.

1. After the merged preparation-only run succeeds, the owner verifies the npm `dirwell` organization and its publication policy, then creates a granular token with package/scope read-write permission restricted to `@dirwell`, direct publishing, bypass 2FA and a one-day expiry. Organization-management permission is not needed and does not grant package publication. If organization policy disallows token publishing, stop rather than relax that policy. See [npm access tokens](https://docs.npmjs.com/about-access-tokens/).
2. The owner saves it directly as the repository Actions secret `NPM_BOOTSTRAP_TOKEN`. Do not send the token to an agent. Dispatch `publish-workspace.yml` on main with `version=0.0.1-alpha`, `publish=true`, `authentication=bootstrap-token`. The secret is injected only into the publish step; preparation and consumer verification do not receive it. GitHub OIDC remains required for [provenance](https://docs.npmjs.com/generating-provenance-statements/).
3. Verify all nine registry packages, their provenance and the installed registry consumer, then revoke the npm token and delete the GitHub secret. A partial failure may require rerunning the original failed jobs with the same artifacts before revocation; never substitute payloads or extend the token's scope.
4. Configure a trusted publisher independently on each real package: GitHub owner `vp-tw`, repository `dirwell`, workflow filename `publish-workspace.yml`, no environment. Default subsequent dispatches use `authentication=oidc` and receive no npm token. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) requires the first successful trusted publish within two days of configuration. Configure when the next genuine release is ready; do not invent a version just to test authentication. Until that first OIDC publication and registry readback succeed, the OIDC path is configured or planned, not verified.

The bootstrap mode rejects other versions, missing secrets and missing provenance OIDC. OIDC mode rejects an injected npm token instead of silently falling back. The legacy package and its publisher remain separate.

## Publish and recover

After the committed release changes are qualified, dispatch the exact merged version with `publish=true` and the applicable authentication mode. Only the publish job has `id-token: write`; it publishes the verified tarballs with provenance and without package lifecycle scripts. The temporary bootstrap secret is removed after first-release verification; subsequent publication uses no static npm secret.

Before its first write, the script looks up every exact package version. Matching SHA-512 bytes are skipped on a retry; conflicting bytes stop the entire attempt and require a new version. Missing packages publish in dependency order. Publication is not atomic across packages: a failure can leave a partially available family. Rerun failed jobs in the original run so they reuse its verified artifacts. Do not dispatch the same version from another source or rebuild tarballs during a retry.

Existing versions without the expected provenance or `alpha` tag fail readback. The workflow does not silently move a tag; standalone dist-tag changes have separate publisher permissions. No package is unpublished as a recovery action.

## Read back delivery

The workflow verifies each exact registry version, downloaded tarball integrity, alpha tag, provenance source/workflow and package payload digest. It then installs the registry family, compares lockfile integrity, runs `npm audit signatures` and exercises the installed consumer. Only after those pass does it create the `@dirwell/workspace@<version>` GitHub prerelease/tag bound to the exact source commit. Registry/provenance propagation retries are bounded; a timeout is incomplete delivery, not successful publication verification.

Pages deployment remains separate. The docs distinguish the published alpha API from legacy examples; current public examples are not proof of installed alpha registry behavior. Preserve platform and browser limits, including unverified physical gamepads, hostile filesystem mutation, distributed caches and production-scale performance.

## First release delivery

The nine `0.0.1-alpha` packages were published and independently verified on October 13, 2026. The [bootstrap workflow](https://github.com/vp-tw/dirwell/actions/runs/38351793577) and [SDK prerelease](https://github.com/vp-tw/dirwell/releases/tag/%40dirwell/workspace%400.0.1-alpha) bind delivery to the [verified release source](https://github.com/vp-tw/dirwell/commit/7763bd7491586ef4444f839c22feb0acdcb708ff). First-publication processing made exact-version data visible before package dist-tags; two bounded readbacks stopped, then the original failed jobs succeeded after propagation. Every retry reused the original verified tarballs and skipped identical registry versions. Registry integrity, signatures, provenance and the installed consumer passed in CI and independently.

The GitHub bootstrap secret has been deleted. npm token revocation requires the owner's final confirmation; do not equate secret deletion with registry credential revocation. OIDC configuration and its first real publication remain unverified. Configure each trusted publisher when the next genuine release is ready to meet npm's two-day validation window.
