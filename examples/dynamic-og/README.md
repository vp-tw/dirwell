# Dynamic share images

From the repository root, run `pnpm dirwell build files --cwd examples/dynamic-og -o dist` after installing the repository dependencies. The source config imports Dirwell from this checkout; in your project import from `@vp-tw/dirwell`.

This Crosswave example generates a separate 1200×630 PNG for each folder at build time. Its six source files span three folders. Descriptions count immediate folders, files, and symlinks; the default themes instead use whole-site counts and one shared static image.

- Root: `2 folders · 1 file`
- `docs/`: `2 files`
- `images/`: `1 folder · 2 files`
- `images/posters/`: `1 file`

The callback runs after title and description resolve. `File.name` supplies a filename hint; `outputPath` controls the published path relative to the output root. Add `metadata.siteUrl` with your deployed explorer root to emit absolute Open Graph image and canonical URLs. No request-time renderer or remote font service is required.
