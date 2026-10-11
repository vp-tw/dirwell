# Crosswave file browser

A complete packaged theme inspired by the PSP crossbar: horizontal file
categories, a vertical item list, original geometric icons, and procedural
ribbon lighting. No console firmware assets or external runtime dependencies.

```ts
import { createCrosswaveTheme, defineConfig } from "@vp-tw/dirwell";

export default defineConfig({
  theme: createCrosswaveTheme({ color: "azure", project: { name: "Sample media files" } }),
});
```

Run `pnpm examples:build` to generate the published example under
`docs/public/examples/crosswave/`. For an independent CLI build, run
`pnpm dirwell build files --cwd examples/crosswave -o ../../generated/crosswave`
from the repository root. Keep CLI output separate from the Vite-owned site tree.

The SVG color study, short silent WAV, half-second WebM color study, and binary
specimen are original synthetic files. They exist to exercise real file-type
navigation; the theme does not autoplay or preview file contents. The sample
symlinks exercise internal and broken declared-target links.

Arrow keys navigate, Enter opens a focused item, Backspace goes to the parent,
and `/` focuses local search. Categories and search are enhancements; all
entries remain native links without JavaScript. Modified metadata remains UTC;
the header clock uses the visitor's local date and time.

Gamepad support uses fresh standard-mapped browser Gamepad API snapshots,
connection events, a stick deadzone, delayed direction repeat, and edge-triggered
confirm/back buttons. Synthetic browser tests cover these behaviors; no physical
controller or USB/Bluetooth stack is claimed verified. Hold-at-connect is ignored
until release to prevent accidental opening across document navigation. A blocked
controller-initiated file tab shows a keyboard/click recovery message.

Directory changes load generated page data and replace the file area inside a persistent shell. The canvas and controller loop keep running; entering and returning slide in opposite directions. Browser history restores folder state. Classic page-data scripts also work with relative-link local HTML, using a hash route when file paths cannot be rewritten. Failed, cancelled, superseded, or timed-out loads retain a usable listing and provide retry/native-link recovery. Native cross-document View Transitions remain a fallback for ordinary full-page navigation. Reduced motion disables
spatial transitions and animated light; the waves can also be paused manually.
WebGL failure retains a static ribbon background. Animation and controller
polling stop while the page is hidden or suspended.

Research: [Sony's XMB manual](https://www.playstation.com/content/dam/global_pdc/en/corporate/support/manuals/psp-docs/ENUK_PSP-E1002_E1003-6.50.pdf),
[community shader study](https://github.com/fchavonet/creative_coding-xmb_wave_background),
[VueUse useGamepad 14.3.0](https://github.com/vueuse/vueuse/blob/v14.3.0/packages/core/useGamepad/index.ts),
and [cross-document transitions](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document).
The implementation uses original code and geometry rather than copying those
projects' assets or shader sources.
