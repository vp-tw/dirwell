# Lightweight theme

The lightweight theme is a browser-native directory listing. It keeps the
filesystem as the content and uses semantic HTML: a heading, linked breadcrumbs,
an unordered list, links, small metadata, and machine-readable timestamps.

It has no icons, JavaScript, client-side search, sorting controls, color-scheme
switch, or generated search index. The only CSS sets a readable maximum width,
spacing, and emergency wrapping for long names. It deliberately keeps the
browser's default typography, link colors, focus indicator, and list markers.

The same complete HTML is emitted in SSG and MPA modes. Very large directories
will produce large documents; use the default theme when virtualization or
client-side search matters. Broken links may open their raw target text in a new
tab; links outside the root remain visible but unavailable.
