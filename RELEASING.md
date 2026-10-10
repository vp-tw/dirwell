# Releasing Dirwell

The package is `@vp-tw/dirwell`; the executable is `dirwell`. Use the configured OIDC workflow. Stable versions publish to `latest` and create a normal GitHub release; `-alpha.N` versions publish to `alpha` and create a prerelease. The workflow filename remains `publish-alpha.yml` because npm's existing trusted publisher is bound to it.

## Prepare and verify

Add a Changesets note for package changes, including packaged documentation. Run `pnpm release:version` and `pnpm install --lockfile-only`. Update the private theme example's exact peer dependency to the prepared version. Review the version and changelog; do not version a committed release again just to silence Changesets status.

For an explicitly approved prerelease, use Changesets prerelease mode; exit it before promoting that line. Docs-site-only changes deploy through Pages without an npm version.

```sh
pnpm audit:dependencies
pnpm check
pnpm test
pnpm test:browser
pnpm test:compat
pnpm build
pnpm site:build
pnpm verify:package
```

The package proof installs Dirwell and an external theme separately and exercises public imports/types, CLI, SSG/MPA assets and real build-host consumption. This is tarball evidence; registry consumption is verified after publication. See [dependency security](DEPENDENCY_SECURITY.md) for the two retained Farm development findings and the guarded audit.

## Merge and publish

Merge the verified version first. Dispatch its exact version from main:

```sh
gh workflow run publish-alpha.yml --ref main -f version=0.1.0
```

The script rejects mismatched source/version/tag, unexpected repositories/refs/events, unsupported prerelease labels and malformed versions. Only the publish job has `id-token: write`. It publishes the immutable verified tarball with provenance. Subsequent jobs install the registry package, verify signatures and provenance cryptographically, and bind the Git tag to the same source commit.

## Read back delivery

Use the released version:

```sh
npm view @vp-tw/dirwell@0.1.0 version dist.integrity dist.attestations --json
npm dist-tag ls @vp-tw/dirwell
pnpm verify:package --registry
```

Confirm the expected `latest` or `alpha` tag, artifact integrity, provenance source, Git tag and GitHub release/prerelease status. The workflow stores `registry-proof` as an artifact. Publishing stable does not move the `alpha` tag.

Pages deploys separately after the main push. Verify its source and actual public pages, including nested directory navigation under the deployed base. npm publication alone does not prove site deployment.

## Recovery and publisher maintenance

If publication succeeds but readback fails, rerun failed jobs on the original workflow run. It retains the source and tarball; the script accepts an existing version only when its bytes match. Registry/provenance readback retries for up to ten minutes. Never dispatch an existing version from different source or republish different bytes; release a new version for a repair.

The publisher is bound to `vp-tw/dirwell` and `publish-alpha.yml`, with publish/stage-publish permissions and no GitHub environment restriction. Standalone dist-tag management is a separate permission; normal publication sets its selected tag. Changing repository, workflow filename or environment requires corresponding npm settings and may need human MFA. Do not store credentials in the repository.

The first verified alpha OIDC publication is preserved in its [historical workflow](https://github.com/vp-tw/dirwell/actions/runs/37800608707) and [prerelease](https://github.com/vp-tw/dirwell/releases/tag/%40vp-tw/dirwell%400.1.0-alpha.1). See [trusted-publishing evidence](TRUSTED_PUBLISHING_PLAN.md) and [npm's documentation](https://docs.npmjs.com/trusted-publishers/).
