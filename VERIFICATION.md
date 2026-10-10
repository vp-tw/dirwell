# Local verification record

This record describes the 2026-10-10 verification run that started from Dirwell
0.1.0 and produced the 0.1.1 corrections. Coverage below applies to the listed versions and test methods.

## Automated regression

The host was an Apple Silicon Mac running macOS 26.6.2, Node 26.11.1,
pnpm 11.25.0, and Playwright 1.63.0.

| Check                     | Result and scope                                                                                                                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node tests                | 121 passed: generator, configuration, metadata, assets, timestamps, documentation, rebuild recovery, and real adapter builds/watch paths.                                                                                                                                        |
| Full browser suite        | 339 passed: 113 each in Chromium 153.0.8010.12, Firefox 155.0, and Playwright WebKit 26.6. Covers SSG/MPA, file URLs, navigation/history, keyboard and virtual controller input, responsive layouts, offline fonts, metadata, no-JavaScript output, and expected-error recovery. |
| Installed Chrome channels | 15 bounded checks passed across Chrome 154.0.8037.98, Beta 156.0.8078.12, and Dev 157.0.8092.0. Covers theme contracts and the IME regression; this is not a full regression of each channel.                                                                                    |
| Focus regression          | Firefox's exact-time focus scenario passed five consecutive runs after the correction. The deterministic IME regression also passed in all three engines.                                                                                                                        |
| Cross-engine CI suite     | 15 checks cover theme contracts and global-search IME behavior. Full Chromium regression remains a separate job.                                                                                                                                                                 |

Run `pnpm test`, `pnpm test:browser`, `pnpm test:compat`, and
`pnpm test:browser:all` after installing the corresponding Playwright engines.
See [contributing](CONTRIBUTING.md) for build and installed-package verification.

The run found that an IME commit followed by its final input event could execute
global search twice and replace the focused exact-time control. A failing
regression demonstrated the duplicate result update before both events were
debounced together. Crosswave tests now simulate in-progress composition without
letting automation's `fill()` commit it, and check native navigation when
cross-document View Transitions are unavailable.

## Additional environments

| Environment                                          | Observed behavior                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Linux ARM64, Debian/glibc                            | The published 0.1.0 package and the 0.1.1 tarball installed in disposable official `node:26-bookworm-slim` containers. All three themes generated SSG/MPA output and native PNG share images; encoded names, symlinks, CLI build/serve, and file creation/live rebuild passed.                                                                                                                               |
| Linux ARM64, Alpine/musl                             | The same registry/tarball consumer checks passed in official `node:26-alpine`. Both ARM64 containers used Node 26.11.1 and disabled npm install scripts.                                                                                                                                                                                                                                                     |
| Linux x64, Alpine/musl, emulated                     | The 0.1.1 tarball passed the same consumer checks under Docker's `linux/amd64` emulation. This verifies x64 native-module loading in the container, not physical Intel performance.                                                                                                                                                                                                                          |
| Native macOS Safari 26.6.2                           | A separate normal Safari window exercised Ledger search, clearing and keyboard parent navigation; Crosswave search, folder navigation and Back/Forward; and Plain folder/parent links on the published examples. The window was closed afterward. Remote Automation remained disabled.                                                                                                                       |
| iPhone 17 and iPad (A16) simulators, Safari/iOS 26.5 | Three published themes passed a bounded DOM/layout smoke at 402 and 820 CSS pixels in portrait: local fonts, no horizontal overflow, folder/parent links, search, and Crosswave category/motion controls. Text and activation were synthesized through DOM events. Native keyboard/touch and simulator Back/Forward are not verified: WebDriver input/history commands were unreliable in this installation. |

The simulator observations are not physical-device acceptance. The first local
run had no usable Windows VM; Windows consumer coverage and the user-reported
controller smoke were added in the follow-up below. Physical iOS devices, other
controller mappings, real screen-reader output, and low-end hardware remain
outside the agent's completed evidence. Adapter tiers
and Farm's standalone-watch limitation remain unchanged; see
[support and compatibility](docs/src/content/docs/support.md).

## Accessibility and workload

An axe-core 4.12.1 audit of the three published theme examples found no automated
violations. Ledger and Crosswave had incomplete contrast checks; gradients,
canvas, and image-backed regions require separate visual/contrast assessment.
This is not a WCAG conformance claim or a VoiceOver test. Crosswave's clock now
uses a description instead of `aria-label`, which the implicit `time` role does
not permit. See [ARIA in HTML](https://www.w3.org/TR/aria-in-html/).

The 10,000-file and 20-level workloads stayed within the existing local budgets.
At 4× CPU throttling, the desktop and narrow virtual-list sweeps showed no empty
viewport or positive gaps between visible rows. See [benchmark observations](BENCHMARKS.md)
for workload definitions, timings, and their limits.

## Follow-up verification

The additional native-platform consumer run uses the same built 0.1.1 tarball
on six standard GitHub-hosted runners: Linux, Windows, and macOS, each in ARM64
and x64 variants. All six passed three-theme SSG/MPA generation, native share
images, encoded filenames, valid/broken file symlinks, CLI build/serve, and live
file creation, modification, and deletion. The three fixed-font PNGs were
byte-identical across all six runners. These are bounded installed-consumer
checks; they do not establish every Windows build-adapter or browser behavior.

The reusable workflow is [platform consumer verification](.github/workflows/platforms.yml).
Run `node scripts/verify-platform.mjs <tarball-or-version> <report-directory>`
locally. It creates a disposable consumer, installs with npm scripts disabled,
tests the package, writes a JSON report, and removes the consumer. The runner
report keeps OS, architecture, Node version, image hashes, and any symlink limit.

### User-reported controller smoke

The maintainer reported a Windows + Xbox controller test with no major problem
observed. The browser, Windows/Dirwell versions, connection type, and complete
button/axis coverage were not specified. This is physical-controller evidence
reported by the user; the agent did not reproduce that hardware test. Other
controller mappings and physical iOS devices remain unverified.

### Text contrast assessment

Built-in settled text states received an additional quantitative check:

| Theme/state                                                     | Lowest assessed ratio |
| --------------------------------------------------------------- | --------------------: |
| Ledger light, six foreground tokens against four surface tokens |                5.00:1 |
| Ledger dark, the same token combinations                        |                7.36:1 |
| Plain native text and links against the rendered white Canvas   |      21.00:1 / 9.40:1 |
| Crosswave Azure                                                 |                5.13:1 |
| Crosswave Violet                                                |                5.24:1 |
| Crosswave Amber                                                 |                4.88:1 |
| Crosswave Rose                                                  |                5.16:1 |
| Crosswave Jade                                                  |                4.83:1 |
| Crosswave Graphite                                              |                5.22:1 |

Ledger uses the rendered CSS token values. Crosswave combines five actual WebGL
framebuffer samples per palette with conservative bounds for every wave time,
the CSS fallback, and the selected/hover row layer. The shader's lower region
uses its full light cap; above y=0.7, the maximum wave center and breadth bound
the light contribution below 0.0001. One color byte covers framebuffer rounding.
The opaque muted text color is the weakest built-in text foreground used here.

All assessed values exceed the [4.5:1 normal-text minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum).
This closes the specific built-in text/background uncertainty from the automated
audit. It does not certify user overrides, motion intermediate states, every
non-text control boundary, real screen readers, or overall WCAG conformance.

### VoiceOver attempt

With the maintainer's approval, VoiceOver was temporarily enabled in macOS
26.6.2 for a separate Safari private window. Its first-run tutorial restricted
commands and was closed. Both background and foreground keyboard routes were
attempted, but the automation interfaces did not provide reliable Rotor or
spoken-output readback. Enabling the service alone is not a passed screen-reader
test. VoiceOver was returned to its original off state, and the original caption,
modifier, and welcome settings were preserved. A separately approved attempt to
enable AppleScript control caused VoiceOver Utility to stop responding; after
restarting the task-owned utility, its control checkbox was confirmed off.
System Events also could not resolve the utility's window while it was
unresponsive. No spoken-output result was obtained, so actual VoiceOver output
remains unverified. A manual screen-reader test is still needed; physical iOS
VoiceOver is a separate unverified environment.
