---
name: Dirwell Plain
description: A minimal browser-native directory index with no generated presentation assets.
typography:
  body:
    fontFamily: serif
    fontWeight: 400
---

# Design System: Dirwell Plain

Plain uses semantic HTML: a directory heading, linked breadcrumbs, an unordered list, native links, entry details, and machine-readable UTC timestamps. It keeps native link colors, focus indicators, list markers, and the browser's system serif font. Native colors follow the system appearance through `color-scheme: light dark`.

The body retains a readable maximum width (72ch), centered margins (2rem), and horizontal padding (1rem). List rows have .6rem block margins; metadata is block-level. Headings, rows, and breadcrumbs allow emergency wrapping for long names.

The default output has no fonts, JavaScript, icons, search index, social metadata, share image, or brand footer. The title is `Index of /` or the current folder path. Providing `project` opts into the existing repository/author/license footer and an optional project-name title. Providing `metadata` opts into managed text metadata; image generation requires an explicit image source or callback. The optional Plain share-image renderer retains its bundled Source Serif face, but it does not add a browser font.

SSG and MPA both emit the complete listing. Source mirroring and safe raw-link target stubs remain generator behavior. Large folders produce large documents; use Ledger for virtualization or search. External file links still open in a new tab, and unavailable symlinks retain their safe status and declared-target handling.
