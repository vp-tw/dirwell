# Releasing the Dirwell workspace alpha

The new `@dirwell/*` family starts at exactly `0.0.1-alpha`, tagged `alpha`. Its nine official packages share one version. This procedure is separate from the legacy `@vp-tw/dirwell` release and its existing trusted publisher. All new packages currently retain `private: true`; neither packing nor merging removes that publication guard.

## Preparation without npm authentication

1. Commit the qualified source and synchronized manifests. Build with the repository's pinned toolchain, run `pnpm audit:dependencies`, `pnpm check`, `pnpm test`, browser/compatibility checks, `pnpm build`, `pnpm site:build` and `pnpm verify:package`.
2. Run `RELEASE_VERSION=0.0.1-alpha node scripts/workspace-release.mjs prepare`, followed by `RELEASE_VERSION=0.0.1-alpha node scripts/workspace-release.mjs verify`. Preparation creates `.workspace-release/manifest.json` and nine tarballs, recording the commit, packed metadata and SHA-512 integrity. Private artifacts can be prepared and tested, but cannot be published. Repeating preparation reuses the verified manifest and bytes; a different source requires a new `DIRWELL_RELEASE_DIR`, rather than overwriting the old release artifact.
3. Run `node scripts/verify-workspace-consumer.mjs .workspace-release`. This installs only the actual tarballs in an isolated consumer, then exercises all themes, static modes, CLI, live server/files and optional metadata/images. Real build-host tests execute separately in the repository suite. The platform workflow independently qualifies installed tarballs on 18 OS/architecture/Node combinations.
4. After merge, dispatch `publish-workspace.yml` with the exact version and `publish=false`. It repeats required checks and retains the verified artifacts. This path never requests an OIDC token or publishes. A later publication change must be committed and qualified again before `publish=true` is used.

The release script rejects mixed versions, unknown/omitted packages, unresolved internal dependencies, unsafe filenames, mismatched metadata, altered bytes, out-of-order dependencies and incorrect publication source/event/ref. Packing uses pnpm's workspace dependency resolution; no development symlink is accepted as registry qualification. The official order is core, Plain, server, share-image, integrations, Ledger, Crosswave, CLI.

## First-publication gate

Organization ownership has been verified, but CLI authentication, first-package bootstrap and publisher settings remain unfinished. Do not restart the expired login flow or assume a browser login authenticates npm CLI. Do not copy browser credentials, store a token in the repository, publish placeholder payloads, or remove 2FA requirements to bootstrap the family.

The existing legacy workflow is not configured to publish these names. The new trusted-publisher coordinates will be GitHub owner `vp-tw`, repository `dirwell`, workflow filename `publish-workspace.yml`, with no environment currently declared. Each package needs its own configuration and independent readback. [npm's trusted-publishing guide](https://docs.npmjs.com/trusted-publishers/) requires supported hosted runners; [npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust/) requires the package to exist for configuration. First-publication bootstrap must therefore be settled during the final npm handoff, rather than assumed to work through OIDC.

A local first publish with MFA cannot supply this workflow's GitHub provenance. A credential-assisted first publish from CI would introduce a sensitive credential decision. The automation below is prepared for qualified OIDC publication; it does not silently choose either bootstrap alternative. Verify the platform's available first-publish mechanism at the handoff before asking for the exact choice. Any exception to provenance or credential handling requires an explicit decision.

## Publish and recover

After bootstrap, publisher setup and the committed removal of private guards are qualified, dispatch the exact merged version with `publish=true`. Only the publish job has `id-token: write`; it publishes the verified tarballs with provenance and without package lifecycle scripts. No long-lived npm secret is configured.

Before its first write, the script looks up every exact package version. Matching SHA-512 bytes are skipped on a retry; conflicting bytes stop the entire attempt and require a new version. Missing packages publish in dependency order. Publication is not atomic across packages: a failure can leave a partially available family. Rerun failed jobs in the original run so they reuse its verified artifacts. Do not dispatch the same version from another source or rebuild tarballs during a retry.

Existing versions without the expected provenance or `alpha` tag fail readback. The workflow does not silently move a tag; standalone dist-tag changes have separate publisher permissions. No package is unpublished as a recovery action.

## Read back delivery

The workflow verifies each exact registry version, downloaded tarball integrity, alpha tag, provenance source/workflow and package payload digest. It then installs the registry family, compares lockfile integrity, runs `npm audit signatures` and exercises the installed consumer. Only after those pass does it create the `@dirwell/workspace@<version>` GitHub prerelease/tag bound to the exact source commit. Registry/provenance propagation retries are bounded; a timeout is incomplete delivery, not successful publication verification.

Pages deployment remains separate. The docs currently distinguish the unreleased alpha API from legacy examples; current public examples are not proof of installed alpha registry behavior. Preserve platform and browser limits, including unverified physical gamepads, hostile filesystem mutation, distributed caches and production-scale performance.
