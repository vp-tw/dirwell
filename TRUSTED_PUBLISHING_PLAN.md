# Trusted alpha publishing plan

Trusted publishing is configured for `@vp-tw/dirwell` and was verified by a real
OIDC alpha release. This document records security gates and historical evidence.
For the current release procedure, use [RELEASING.md](RELEASING.md).

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

Releases use manual dispatch after a reviewed version PR. A Changesets
version-PR bot remains optional. Keep release automation scoped
to the package; account-level token restrictions and permission changes require
a separate security decision.

## Failure and rollback

A failed pre-publish check leaves the registry unchanged. If upload succeeds but
readback is delayed, retry readback rather than republishing that version. A
published version is immutable; repair a faulty alpha by publishing the next
alpha with a changeset and, when justified, deprecating the faulty version.
Changing a tag is not removal of an uploaded version.

A newly configured npm trusted publisher must meet the provider's validation
deadline. Consult the current npm documentation and configure it only when the
reviewed release is ready. An unvalidated configuration, skipped job,
or green source CI is not publication/provenance evidence.

The bootstrap package now exists. `publish-alpha.yml` implements the manual
dispatch path with separate verification, OIDC publishing, registry consumer,
and GitHub prerelease jobs. The first verified OIDC release was `0.1.0-alpha.1`.
Configuration readback and the first successful OIDC run are recorded below.
Future releases follow the same gates. The later Changesets version-PR bot is
optional; versioning currently uses a reviewed contributor PR.

## First OIDC release evidence

The npm publisher configuration was created and read back for `vp-tw/dirwell`,
`publish-alpha.yml`, with publish and stage-publish permissions and no
environment. [The first OIDC run](https://github.com/vp-tw/dirwell/actions/runs/37800608707)
published `0.1.0-alpha.1`, verified the registry artifact and source-bound SLSA
provenance, installed the registry consumer, and passed `npm audit signatures`.
[The GitHub prerelease](https://github.com/vp-tw/dirwell/releases/tag/%40vp-tw/dirwell%400.1.0-alpha.1)
and package tag reference the verified source commit. `alpha` advanced to this
release while `latest` remained `0.1.0-alpha.0`.

The initial upload succeeded before the provenance endpoint became available.
Rerunning the failed jobs verified identical existing bytes without republishing.
Readback now retries a temporary provenance `404` within its bounded wait.
Rerun the original workflow's failed jobs to preserve its artifact and commit;
do not start a fresh dispatch of an existing version from a changed main commit.
Primary source: [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
