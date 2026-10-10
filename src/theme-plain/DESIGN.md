---
name: Dirwell Plain
description: A browser-native directory index with bundled serif text.
typography:
  body:
    fontFamily: '"Source Serif 4", serif'
    fontWeight: 400
---

# Design System: Dirwell Plain

## Overview

The plain theme is a browser-native directory listing. It keeps the
filesystem as the content and uses semantic HTML: a heading, linked breadcrumbs,
an unordered list, links, small metadata, and machine-readable timestamps.
The footer uses a native horizontal rule and plain text to identify the
repository, author, and license. External links open in a new tab.
The default repository name links to the published Dirwell repository. An
invalid custom URL remains plain text.

It has no icons, JavaScript, client-side search, sorting controls, color-scheme
switch, or generated search index. It deliberately keeps the browser's native
link colors, focus indicator, and list markers.

## Typography

Bundled Source Serif 4 Regular (400) replaces the browser's default serif
family. The local Latin face applies to body text and native form controls;
heading sizes and weights still follow browser defaults. Only Regular is
bundled, so bold headings use browser synthesis.

The built-in Open Graph image uses the same Source Serif 4 Regular face from
a bundled OTF for the title, repository/theme labels, counts, and optional
folder path. Its white ground and horizontal rule retain the plain index
character.

## Layout

The body has a readable maximum width (72ch), centered margins (2rem), and
horizontal padding (1rem). List rows have .6rem block margins; metadata is
block-level. Headings, rows, and breadcrumbs allow emergency wrapping for long
names.

The same complete HTML is emitted in SSG and MPA modes. Very large directories
will produce large documents; use the default theme when virtualization or
client-side search matters. Broken links may open their raw target text in a new
tab; links outside the root remain visible but unavailable.
