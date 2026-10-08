# Trusted alpha publishing plan

Bootstrap `@vp-tw/dirwell` manually first and verify its npm identity, organization
permissions, alpha tag, tarball, and registry consumer. Then configure a
GitHub Actions trusted publisher for this package and this repository; do not
add a long-lived npm publish token.

## Gates

1. A contributor adds an in-scope changeset. A version PR applies the alpha
   release and repository formatting. Review its version, changelog, and lockfile.
2. The merged release commit passes checks, Node/browser tests, package/site
   builds, and packed consumer verification. The publish job must reject a
   non-alpha version or a non-alpha tag during this phase.
3. A reviewed manual-dispatch workflow on a GitHub-hosted runner publishes the
   exact checked artifact using npm trusted publishing. Grant `id-token: write`
   only to that job, and match the npm configuration's owner, repository,
   workflow filename, and optional environment exactly.
4. Registry metadata, alpha dist-tag, package integrity, registry consumer, Git
   tag, and GitHub prerelease are read back. Verify the provenance attestation
   separately; an OIDC configuration page is not a successful publish.

Start with manual dispatch for an alpha release, then consider a Changesets
version-PR workflow once this path is exercised. Keep release automation scoped
to the package; account-level token restrictions and permission changes require
a separate security decision.

## Failure and rollback

A failed pre-publish check leaves the registry unchanged. If upload succeeds but
readback is delayed, retry readback rather than republishing that version. A
published version is immutable; repair a faulty alpha by publishing the next
alpha with a changeset and, when justified, deprecating the faulty version.
Changing a tag is not removal of an uploaded version.

npm trusted publisher configuration must complete its first successful publish
within the provider's validation period (currently two days). Configure it only
when the reviewed release is ready. An unvalidated configuration, skipped job,
or green source CI is not publication/provenance evidence.

The bootstrap package now exists. `publish-alpha.yml` implements the manual
dispatch path with separate verification, OIDC publishing, registry consumer,
and GitHub prerelease jobs. The initial candidate is `0.1.0-alpha.1`.
Configuration readback and a successful OIDC run remain required before closing
the tracking issue. The later Changesets version-PR bot is optional; versioning
currently uses a reviewed contributor PR.
Primary source: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
