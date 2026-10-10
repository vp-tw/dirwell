# Releasing Dirwell alpha

The package is `@vp-tw/dirwell`; the executable is `dirwell`. Releases remain on
`alpha`. A stable release needs a separate decision and the [stable readiness gates](STABLE_READINESS.md). npm trusted publishing is
configured and has completed a verified release; use the existing OIDC workflow.
Do not repeat bootstrap publication or publisher configuration for each release.

## 1. Prepare the next version

Add a Changesets note for an in-scope package change. Packaged README updates
also need a release so installed users receive them. Docs-site-only changes deploy
through Pages and do not require an npm version.

```sh
pnpm release:status
pnpm release:version
pnpm install --lockfile-only
```

Keep `.changeset/pre.json` in alpha prerelease mode. Update the private theme
example's exact Dirwell peer dependency to the new version. Review the version,
changelog, prerelease notes, and lockfile before committing.

Changesets v3 moves consumed prerelease notes into `.changeset/pre/`. The Vite+
formatter runs after versioning because Changesets formatting is disabled.
An already-versioned branch can have no unconsumed notes. On a clean committed
snapshot, `pnpm exec changeset status --since HEAD` checks for new changes.
Do not version again just to make a status command quiet.

## 2. Verify and merge the version

```sh
pnpm check
pnpm test
pnpm test:browser
pnpm build
pnpm site:build
pnpm verify:package
```

`verify:package` packs the library and a private external theme independently,
then installs them into a fresh consumer. It checks public imports, types, CLI,
SSG/MPA renderer assets, Rollup, and async CommonJS webpack. It cleans that
consumer. This proves local distribution behavior, not npm publication.

Review and merge the versioned change before publishing. The release must use
that exact merged source; if main changes, reconcile it before dispatching.

## 3. Dispatch trusted publishing

Read the merged `package.json` version, then pass that exact value as the workflow
input. Replace the illustrative `0.1.0-alpha.N` below with the real new version:

```sh
gh workflow run publish-alpha.yml --ref main -f version=0.1.0-alpha.N
```

The workflow accepts only a new merged alpha on main. It runs source checks,
Node/Chromium tests, builds, and tarball consumer checks before packing an artifact.
Only its publish job has `id-token: write`. That job publishes those exact bytes
with `alpha` and provenance, without a long-lived npm token.

A separate job installs the registry package and runs `npm audit signatures`.
Only after registry verification passes does the workflow create the package tag
and GitHub prerelease. Inspect the whole run, not only the upload job.

## 4. Read back delivery

Use the exact released version in these commands:

```sh
npm view @vp-tw/dirwell@0.1.0-alpha.N version dist.integrity dist.attestations --json
npm dist-tag ls @vp-tw/dirwell
pnpm verify:package --registry
```

Confirm that `alpha` selects the new version. `latest` deliberately remains on
`0.1.0-alpha.0`; subsequent releases advance `alpha` only. Check that the package
tag, GitHub prerelease, artifact integrity, and provenance bind to the released
source commit. The workflow stores the registry proof as an artifact.

The docs site deploys separately through `pages.yml` after a main push. Verify
its deployed commit and actual pages, including a nested explorer example and
the final base path. A successful npm release does not prove site deployment.

## Failure and recovery

If upload succeeds but verification fails, rerun failed jobs on the **original
workflow run**. This retains its source commit and immutable artifact. Registry
metadata or provenance may propagate later; the workflow retries readback for
up to ten minutes. It accepts an existing version only when the artifact bytes
match, and never republishes that version.

Do not dispatch an existing version from a later main commit. Different source
or artifact bytes fail verification. Repair a faulty published alpha with a new
changeset and version. Published versions are immutable.

## Publisher maintenance

The configured publisher is scoped to `vp-tw/dirwell` and `publish-alpha.yml`,
with publish/stage-publish permissions and no GitHub environment restriction.
It does not grant dist-tag management. No publisher change is needed for a
normal release. Changes to its repository, workflow filename, or environment
need matching npm configuration and may require human MFA.

For an authorized configuration change, verify the npm identity and read back
the existing configuration with `npm trust list @vp-tw/dirwell`. Use npm's
supported MFA flow; do not store credentials in the repository. Account-wide
publishing restrictions are a separate security decision.

## Historical evidence

The bootstrap alpha was published manually. The first verified OIDC release was
`0.1.0-alpha.1`; its [workflow](https://github.com/vp-tw/dirwell/actions/runs/37800608707)
and [prerelease](https://github.com/vp-tw/dirwell/releases/tag/%40vp-tw/dirwell%400.1.0-alpha.1)
record publication and provenance. See [trusted publishing evidence and gates](TRUSTED_PUBLISHING_PLAN.md)
and [npm's trusted-publishing documentation](https://docs.npmjs.com/trusted-publishers/).
