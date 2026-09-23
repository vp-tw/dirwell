# Extreme workload benchmark

## Reproduce

Run from the repository root with the checked-in Node toolchain:

```sh
node scripts/benchmark-extreme.ts flat
node scripts/benchmark-extreme.ts deep
```

The script creates temporary source trees, runs the default theme in MPA mode,
measures generation time, process peak RSS, and all output bytes and files, and
removes its temporary files. Add `--keep` to retain the generated tree for
browser inspection; the JSON result prints its directory. Remove that tree
after inspection.

For browser numbers, serve a retained flat output over HTTPS, open its root
page in Chrome, set CPU throttling to 4× in DevTools, and run
`agent-browser eval --stdin < scripts/benchmark-browser.js` from this repo with
the browser session on that page. Run once at 1280 × 800 and once at 390 × 844,
reloading before each run. The browser script measures input-to-result latency
and sweeps the virtual list. It requires the locally installed `agent-browser`
CLI; it is not part of the package or CI test suite.

`flat` has 10,000 two-byte files with long, wrapping names in one directory.
It exercises deferred MPA rows, the measured virtual list, and a global-search
index split into shards. `deep` has 20 nested directories with 100 files at
each level, alternating long and short names. It also includes valid, broken,
outside-root, and cyclic symlinks. The source creation time is excluded from
the generation measurement. Both cases follow symlinks within the root and
skip cycles.

## Baseline

Measured on 2026-09-23 with Node 26.10.0, macOS 26.6.2, Mac14,7, 8 logical
CPUs, and 16 GiB RAM. Runs were local with a warm filesystem cache; they are
not CI results. RSS includes the Node process, not only Dirwell allocations.

| Case        | Generation |      Output | Files in output | Peak RSS |
| ----------- | ---------: | ----------: | --------------: | -------: |
| flat, run 1 |   2,950 ms | 9,135,529 B |          10,040 |  227 MiB |
| flat, run 2 |   3,746 ms | 9,135,529 B |          10,040 |  220 MiB |
| deep, run 1 |   1,110 ms | 3,254,712 B |           2,044 |  106 MiB |

Browser inspection used Headless Chrome 153 at 4× CPU throttling through
Chrome DevTools Protocol. The flat output was served locally over HTTPS. The
browser script recorded these warm-cache runs:

| Viewport   | Reload navigation | Filter to last file | Clear filter | Reverse sort | First global-search match | Heap after sweep |
| ---------- | ----------------: | ------------------: | -----------: | -----------: | ------------------------: | ---------------: |
| 1280 × 800 |             55 ms |               88 ms |        86 ms |        87 ms |                    212 ms |           11 MiB |
| 390 × 844  |             84 ms |               88 ms |        88 ms |        88 ms |                    239 ms |           12 MiB |

The input timings include the runtime's debounce and worker response. These
are single observations, not percentiles. Navigation reflects a cached local
reload, not a first network visit. The heap value is Chrome's reported
JavaScript heap, not total browser memory.

Scrolling across 30 positions between 10% and 90% of the desktop list showed
no viewport without rows and no positive gap between adjacent visible rows.
The maximum two-frame interval observed in that scripted sweep was 40 ms.
At 390 × 844, long names wrapped to a 136 px row; 20 scroll positions showed
no empty viewport or positive gap, with a 34 ms maximum two-frame interval.
Resizing from that width to 1280 px changed the observed row height to 68 px,
and resizing back restored 136 px.

## Provisional local budget

These limits give headroom over the samples above. They are comparison targets
for this machine and workload, not cross-device guarantees or a CI gate.

| Measure                                      |                                                 Target |
| -------------------------------------------- | -----------------------------------------------------: |
| Flat 10,000-entry generation                 |                        under 10 s and 512 MiB peak RSS |
| Flat output                                  |                                           under 20 MiB |
| Deep 2,000-file generation                   |                                              under 5 s |
| Ready-list filter or sort at 4× CPU throttle |                         under 500 ms to visible result |
| First global-search match at 4× throttle     |                                              under 2 s |
| Desktop and narrow scroll sweep              | no empty viewport or positive gap between visible rows |

The current observations are below these targets. They do not identify a
bottleneck that warrants replacing virtualization or changing search behavior.
For a release regression gate, collect repeated cold and warm runs on a fixed
CI runner and a real lower-powered device, then set percentile-based limits.
The 4× CPU setting is a browser simulation; it does not validate physical
low-end hardware, slow storage, or network delivery.
