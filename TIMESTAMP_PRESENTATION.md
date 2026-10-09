# Ledger timestamp presentation for alpha

Keep the established policy: browser-enhanced Ledger rows use the viewer's local time zone; generated HTML and no-JavaScript output remain explicitly UTC; Plain remains UTC. Sorting, `<time datetime>`, and metadata retain the underlying instant.

This decision is implemented in the Ledger alpha theme. See [the current theme guide](docs/src/content/docs/themes.md) for usage. The comparison below records the alternatives considered. Before this change, every row repeated a full offset, such as `2026-10-08 15:20 UTC+08:00`.

## Adopted presentation

Use a concise absolute local label, `2026-10-08 15:20`, for both recent and older files. Keep the year to avoid archive/date-boundary ambiguity. Label the column as local time after hydration. A focusable date control exposes the exact local timestamp with its per-instant offset and the UTC instant; it works with pointer, touch, Enter/Space, Escape, and screen readers. Do not rely on a native hover-only `title`.

Relative time is not enabled in this alpha recommendation. There is no relative threshold or timer to maintain. Render and hydrate through one formatter shared by static rows, virtual rows, and global results.

## Comparison

Reference instant: `2026-10-08T07:20:00Z`; reference now: `2026-10-08T07:35:00Z`.

| Viewer                      | Recommended numeric local label | Locale-formatted absolute alternative | Recent relative alternative |
| --------------------------- | ------------------------------- | ------------------------------------- | --------------------------- |
| en-US / Asia/Taipei         | 2026-10-08 15:20                | Oct 8, 2026, 3:20 PM                  | 15 minutes ago              |
| zh-TW / Asia/Taipei         | 2026-10-08 15:20                | 2026年10月8日 下午3:20                | 15 分鐘前                   |
| ja-JP / Asia/Tokyo          | 2026-10-08 16:20                | 2026/10/08 16:20                      | 15 分前                     |
| en-US / America/Los_Angeles | 2026-10-08 00:20                | Oct 8, 2026, 12:20 AM                 | 15 minutes ago              |

For an older file at `2025-10-08T07:20:00Z`, use `2025-10-08 15:20` in Taipei and `2025-10-08 00:20` in Los Angeles. The numeric recommendation does not introduce translated UI into Ledger. Locale-aware formatting remains available to independent themes, demonstrated by the i18n example.

A viable relative alternative uses relative labels only within the last 24 hours, then absolute dates. It would use minutes below one hour and hours below 24 hours, with a 60-second visible-page refresh and refresh on visibility restoration. Future timestamps must be handled explicitly. It adds a timer and changing row labels, while older archive entries still need absolute dates. This is a presentation choice, not a time-zone policy change.

## Exact-time disclosure and boundaries

Two instants during Los Angeles's fall daylight-saving transition both read `2026-11-01 01:30`: `2026-11-01T08:30:00Z` has UTC-07:00, while `2026-11-01T09:30:00Z` has UTC-08:00. Exact details must use the instant's offset, not today's offset or a single offset in the column heading. Include the UTC ISO instant so a user can distinguish the repeated hour.

At 390 px, retain the date and time together if they fit, and allow the date/time boundary to wrap when necessary. The exact-time panel is constrained to the viewport. At desktop width, align tabular numerals without an offset repeated in every row. No-JavaScript output still contains the readable UTC label and complete listing where that mode supports it.

## Implemented behavior and validation

- Separate concise-label and exact-detail helpers preserve instant-based sorting.
- Hydration, virtual rows, and global-search dates use the same DOM renderer.
- One bounded exact-time disclosure provides accessible labeling, focus handling, and touch/keyboard operation. It closes when its virtual row disappears.
- Validation covers Taipei/Los Angeles date boundaries and the repeated daylight-saving hour, invalid/missing dates, no-JavaScript fallback, static/virtual/global consistency, sorting, keyboard activation, Escape, and narrow viewports.
- README, EXPERIENCE, and theme documentation describe the implemented local/UTC policy. The former all-UTC description in EXPERIENCE has been corrected.

Examples were executed with Node 26 Intl formatting. Relevant primary standards: [ECMA-402 Intl formatting](https://tc39.es/ecma402/) and [HTML popovers](https://html.spec.whatwg.org/multipage/popover.html). Browser tests and desktop/narrow captures separately verify interaction and layout; the calculations alone do not prove those behaviors.
