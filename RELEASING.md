# Releasing Dirwell

Dirwell is published from the repository root as the public npm package
`@vp-tw/dirwell`. The executable remains `dirwell`.

## Alpha releases

The repository stays in Changesets prerelease mode with the `alpha` tag. For
each release, first add a changeset for the package change, then run:

```bash
pnpm changeset status
pnpm changeset version
pnpm install --lockfile-only
pnpm run check
pnpm test
pnpm run build
npm pack --dry-run --json
```

Review the generated version, changelog, lockfile, and tarball file list.
Commit the versioned files and merge them before publishing. On `main`, repeat
the checks and build from the merged commit, then publish:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm test
pnpm run build
pnpm changeset publish
git push --follow-tags
```

Verify the version and `alpha` dist-tag on npm after publishing. The first-ever
publish of a package also receives the `latest` dist-tag because npm requires
one; subsequent prereleases use `alpha`. Confirm that the npm account has
publish access to the `@vp-tw` organization and that npm authentication is
configured before running `publish`.

The initial publish is manual. After the package exists, configure npm trusted
publishing for a GitHub Actions workflow before automating releases. Do not
store a long-lived npm token in the repository.

## Stable release

When the project is ready for a stable version, run `pnpm changeset pre exit`,
add any final changesets, run `pnpm changeset version`, and review the result
before publishing. Exiting prerelease mode is an explicit release decision.
