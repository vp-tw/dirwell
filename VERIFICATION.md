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

The simulator observations are not physical-device acceptance. The machine had
no usable Windows VM; available disk space did not justify creating one for this
run. Windows, physical iOS devices, hardware controller mappings, real screen
reader output, and low-end hardware remain outside this evidence. Adapter tiers
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
