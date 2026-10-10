# Dependency security disposition

The frozen workspace audit was reduced from seven advisories to two on October 10, 2026. Five affected packages were updated. The remaining findings have no upstream patched release and are retained only in the reviewed Farm development dependency graph. This is not a clean raw audit or a claim that the dependencies are generally safe.

Run `pnpm audit:dependencies` for the bounded repository gate and `pnpm audit --json` for the unchanged raw report. CI and alpha preparation run the gate. It rejects a new advisory, a severity/version change, a path outside Farm, a missing/incomplete report, or an upstream `patched_versions` value becoming available. Nothing is placed in pnpm's audit ignore list.

## Patched versions and compatibility

| Package                 | Before | After  | Scope and verification                                                                                                                                                                                                                                                                                                               |
| ----------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| http-cache-semantics    | 4.2.0  | 4.3.0  | Astro HTTP cache dependency; compatible v4 resolution and complete docs build. [Advisory](https://github.com/advisories/GHSA-ch52-4w7c-c8xp).                                                                                                                                                                                        |
| smol-toml               | 1.8.0  | 1.9.0  | Astro metadata/config parsing. Upstream parsing now returns null-prototype objects; docs/config builds verify the actual consumer. [Release](https://github.com/squirrelchat/smol-toml/releases/tag/v1.9.0).                                                                                                                         |
| source-map-js           | 1.2.1  | 1.2.2  | Patch override for every vulnerable workspace resolution, including magicast and PostCSS. Public config/type/build and host tests exercise those paths. [Advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).                                                                                                               |
| postcss-selector-parser | 6.1.4  | 7.1.6  | Override limited to `postcss-nested@6.2.0`. The major change makes insertion during iteration safe; nested selector, `:is`, attribute, media-query and escaped-name outputs are regression-tested. The existing CSS transformer is retained. [Changelog](https://github.com/postcss/postcss-selector-parser/blob/main/CHANGELOG.md). |
| sharp                   | 0.35.4 | 0.35.5 | Optional Astro/webpack image dependency and matching libvips binaries. Native SVG-to-PNG output, dimensions and pixels are tested, followed by docs and real host builds. [Release](https://sharp.pixelplumbing.com/changelog/v0.35.5/).                                                                                             |

The workspace overrides are not inherited by applications installing Dirwell. Existing consumer locks must be refreshed independently; a new Dirwell version does not rewrite them. Normal standalone consumers do not install this workspace's docs tools or optional Farm host. A separately resolved standalone alpha.13 consumer audit reported zero findings; that is dependency metadata evidence, not an exploit or universal security proof.

## Cache verification limit

The registry audit no longer lists `http-cache-semantics@4.3.0` as affected, and its mandatory-revalidation behavior is tested. A direct probe still allows `satisfiesWithoutRevalidation()` with a large `max-stale` value for some zero-TTL policies, including a no-cache response with Set-Cookie. Therefore leaving the advisory's version range is not proof that every sensitive-cache case is fixed.

The actual Astro caller is `dist/assets/build/remote.js`: it creates its own outbound image request and calculates expiry using `storable()` and `timeToLive()`. It does not call `satisfiesWithoutRevalidation()` or forward a website visitor's max-stale directive. Dirwell's CLI server and generated browser runtime do not import the cache library. The exercised repository does not expose the probe's request-reuse path. Reassess this disposition if that call path changes; no upstream issue was filed without separate authorization.

## Retained findings

### braces 3.0.3 — high

[Upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): deeply nested brace **patterns** can exhaust the parser stack; no fixed version is published.

The observed paths are Farm's legacy Chokidar/fast-glob/micromatch graph and its proxy dependency. Chokidar 3 calls `braces.expand()` for its watch pattern. Farm builds watcher inputs and ignored patterns from project/configuration paths. The proxy matcher calls `micromatch([requestPath], configuredPattern)`: the HTTP pathname is a candidate, not the brace pattern it parses. Watch/proxy patterns and source project configuration remain operator-controlled trusted inputs.

Dirwell's standalone server uses Node `fs.watch`; its own adapter watcher uses Chokidar 5. Core selection uses picomatch. None of those paths import braces. Generated static pages contain no Node dependency execution. Farm remains experimental; this retained scope does not certify arbitrary third-party Farm configurations or hostile projects.

Reopen the disposition if an untrusted input becomes a watch/proxy **pattern**, if the dependency leaves the Farm graph, or when an upstream fix appears. Do not expose a service accepting arbitrary user patterns under this exception.

### sprintf-js 1.0.3 — moderate

[Upstream advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c): unbounded precision in a supplied **format string** can exhaust resources; no fixed release is published.

The observed path is `Farm > farm-plugin-replace-dirname > Changesets > read-yaml-file > js-yaml > argparse > sprintf-js`. `read-yaml-file` calls the JS-YAML library's `safeLoad`; the library index does not import its CLI or argparse. The old YAML CLI separately uses argparse with fixed program/help strings. Argparse's error formatting uses a fixed `ignored explicit argument %r` template, with user data supplied as a value. This is not a user-controlled precision format string in the exercised build path.

Dirwell uses citty for its CLI and does not import this formatter. Reopen the disposition for a new dynamic-format call, a path outside Farm, or an upstream patch. This is not permission to feed untrusted format strings to sprintf-js in other applications.

## Recheck and closure

[Dependency audit issue](https://github.com/vp-tw/dirwell/issues/56) is complete only after verified dependency installation, relevant config/docs/host tests, raw and guarded audit readback, and publication/site verification when required. The guarded gate retains the two warnings visibly; zero unreviewed findings must never be reported as zero vulnerabilities. Recheck the live upstream advisories at the stable release candidate.
