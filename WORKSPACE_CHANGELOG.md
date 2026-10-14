# SDK workspace changes

The nine official `@dirwell/*` packages use synchronized versions. `0.0.1` is the first non-prerelease family; the 0.0.x API may evolve, so pin the version qualified by your application.

## 0.0.1

- Validate direct Core/Server/CLI/build configuration and callback listing plans before initialization or output replacement, with complete paths and nearest-key suggestions.
- Keep explicit globs and ordered Git-style ignore files; CLI defaults to optional cwd `.gitignore`, while Core/configured adapters retain explicit empty defaults.
- Protect output ownership, require deliberate force for unrelated nonempty targets, retain canonical containment/locks/rollback and provide write-free selection reports.
- Support shared labels, language/direction/date settings, identity/CSS tokens, columns, independent actions and public JSON annotations; allow static file URLs independent of explorer URLs.
- Preserve shareable controls, History selection/scroll and successful views during failed/superseded navigation; measure/window both rich lists and keep native no-JavaScript pagination.
- Provide executable package/source/host/private-session/CSP recipes, qualified scales/device boundaries and durable SDK documentation. Official themes retain native file opening/downloads rather than embedded previews.
- Publish one verified nine-package family with exact dependencies, provenance and latest tags. Font injection and live archive/distributed-cache expansion remain separate follow-ups.

## 0.0.1-alpha.1

- Include minimal Plain in the CLI. `dirwell server <source>` and
  `dirwell build <source> --out <output>` no longer need an explicit theme.
  Core and integrated HTML still require one; rich themes remain separate.
- Discover native `dirwell.config.mjs`, allow `--config` overrides, and preserve
  explicit theme/config/default precedence. Add `plain`, `ledger`, `crosswave`
  shortcuts and resolve themes supplied through npm exec outside a project.
- Reject silently ignored legacy config files so migration cannot lose file
  selection rules; clarify that new and compatibility CLIs share a bin name.
- Respect `server.host`/`server.port` configuration, retain live polling settings
  when `--live` enables updates, and fail on flags belonging to the other mode.
- Keep live directories available when an enumerated child disappears before
  metadata reads. Preserve SSE subscriptions and permission/path failures.
- Default live listing data to one complete block, avoiding repeated scans for
  clients that need the whole directory; explicit block policies remain available.
- Retain immutable CSS/client resources and hashes per rich-theme instance;
  keep filesystem listings fresh and retain authorization before responses.
- Wait within existing bounds for registry packument/alpha-tag propagation,
  retaining source/provenance/integrity validation and never moving tags.
- Clarify SDK/compatibility documentation and preserve hidden browser-failure
  artifacts. Update local packed verification for synchronized subsequent alphas.

## 0.0.1-alpha

First nine-package SDK release: explicit core themes, minimal Plain, native
Svelte Ledger and Vue Crosswave, live HTTP/file/SSE serving, standalone CLI,
optional build metadata/images, build-tool integrations, and paired source
component authoring with local framework HMR. Registry payloads, provenance,
signatures and installed consumers were verified before release completion.
