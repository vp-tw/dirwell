# Releasing Dirwell alpha

The package is `@vp-tw/dirwell`; the installed executable remains `dirwell`.
The bootstrap release was `0.1.0-alpha.0`. Keep Changesets in `alpha` prerelease mode
and publish with the explicit `alpha` dist-tag. A stable version requires a
separate release decision.

## Version preparation

The root library is explicitly included in `pnpm-workspace.yaml`; the docs
package is private. Add a changeset describing a package change, then inspect
and apply its release plan:

```sh
pnpm release:status
pnpm release:version
pnpm install --lockfile-only
```

`release:version` runs Changesets followed by the repository's `vp fmt`.
Changesets automatic formatting is disabled because Vite+'s standalone
`oxfmt` entry is an IDE wrapper; formatting remains owned by Vite+.

Changesets v3 moves consumed prerelease notes into `.changeset/pre/`. Before
versioning, `release:status` compares changes with `main` and checks that they
have release notes. An already-versioned release branch can consequently report
changed packages with no unconsumed changesets. On a clean committed snapshot,
`pnpm exec changeset status --since HEAD` checks for new changes without
re-applying the consumed release. Do not run `release:version` again merely to
make a status command quiet.

Review the version, changelog, prerelease state, and lockfile. Verify:

```sh
pnpm check
pnpm test
pnpm test:browser
pnpm build
pnpm site:build
pnpm verify:package
```

The last command packs the library and a private external theme independently,
then checks installed imports, CLI output, public types, SSG/MPA theme assets,
Rollup, and an async CommonJS webpack configuration. It cleans its temporary
consumer. These are local distribution checks, not npm publication evidence.

## First publish

Merge the verified versioned changes before publishing. Build and pack from
that exact merged commit; if `main` has changed, reconcile and verify the new
code rather than silently using an older artifact.

Confirm the npm identity with `npm whoami` and verify that account's `@vp-tw`
organization publishing permission. Authentication or permission failures stop
publication. Complete any npm two-factor challenge through npm's supported
flow; do not store a long-lived token in the repository.

Use npm directly for the bootstrap publish, with an explicit alpha tag:

```sh
mkdir -p .impeccable/review/alpha
npm pack --pack-destination .impeccable/review/alpha --json
npm publish .impeccable/review/alpha/vp-tw-dirwell-0.1.0-alpha.0.tgz --tag alpha --access public
```

Inspect the pack file list and the intended name/version before the publish.
Changesets can add `latest` when bootstrapping an unpublished package in
prerelease mode, so the initial command deliberately chooses npm's explicit
`--tag alpha` path. See [Changesets prereleases](https://changesets.dev/guide/prereleases)
and [npm publish tag behavior](https://docs.npmjs.com/cli/v12/commands/npm-publish/).

After a successful publish, read back the registry and install the exact version:

```sh
npm view @vp-tw/dirwell@0.1.0-alpha.0 version dist.integrity --json
npm dist-tag ls @vp-tw/dirwell
pnpm verify:package --registry
```

Verify that `alpha` points to the published version and that no stable version
was introduced. A successful upload alone is insufficient. If metadata or
installation is not available yet, retry readback; do not repeat a successful
publish of the same version.

Only after registry/consumer readback succeeds, create and push the package tag
`@vp-tw/dirwell@0.1.0-alpha.0` and a GitHub prerelease referencing that verified
commit. Keep the Git tag, npm version, package integrity, and release notes
aligned. Do not claim provenance for a manual local publish.

## Trusted alpha publishing

The reviewed `.github/workflows/publish-alpha.yml` workflow publishes only a
merged alpha version from `main`. Its manual dispatch requires the exact version
as input. Version and review the changes through a PR first; update the private
theme example's exact peer dependency alongside the core version.

Configure the package publisher after the workflow is merged:

```sh
npm whoami
npm trust github @vp-tw/dirwell --repository vp-tw/dirwell --file publish-alpha.yml --allow-publish --yes
npm trust list @vp-tw/dirwell
gh workflow run publish-alpha.yml --ref main -f version=0.1.0-alpha.1
```

Complete npm's MFA flow when requested. The publisher grants direct publishing
to this workflow; it does not use a long-lived npm token or grant dist-tag
management. No GitHub environment is configured, so leave that publisher field
empty. This scope does not change account-wide token restrictions.

The workflow verifies source, Node/browser tests, builds, and tarball consumers
before uploading an artifact. Only the publish job has `id-token: write`. It
publishes those exact bytes with `alpha`, then retries registry readback for up
to ten minutes. Readback checks the integrity, alpha tag, and provenance payload
against the workflow path and source commit. A separate job installs from npm
and verifies signatures/provenance with `npm audit signatures`. Only then does
the final job create a package tag and GitHub prerelease.

If upload succeeds but later readback fails, rerun the failed jobs. An existing
version is accepted only when its bytes match; it is never republished. A
different existing artifact fails the workflow. Repair a faulty release through
a new changeset and alpha version. `latest` remains on the bootstrap alpha by
the maintainer's decision; subsequent releases advance `alpha` only.

The implementation is not proof of a configured or validated publisher.
Record the npm configuration readback, successful workflow, registry consumer,
provenance, and release links in the tracking issue after the first OIDC run.
See [the trust and rollback gates](TRUSTED_PUBLISHING_PLAN.md) and
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
