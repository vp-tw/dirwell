# Releasing Dirwell

The active release line is the nine-package `@dirwell/*` SDK. Follow [the workspace release procedure](WORKSPACE_RELEASING.md): synchronize versions, qualify immutable tarballs, publish with OIDC and independently verify registry consumers. Never republish an existing version.

The documentation site deploys separately from main through GitHub Pages. Verify the deployed source and actual root/child pages after a documentation or example change. A site-only update does not require an SDK version bump.

The root package and `publish-alpha.yml` are retained for historical compatibility verification, not new feature delivery. The root Changesets command does not version the SDK family. Historical release records remain in CHANGELOG.md and GitHub releases.
