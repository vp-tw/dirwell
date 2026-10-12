# @dirwell/theme-plain

Private workspace prototype. A native HTML renderer with no runtime npm dependencies, browser JavaScript, icons, fonts or default OG images.

`createPlainTheme` returns a structurally compatible core theme. It handles independently generated static pages with native Previous/Next anchors and directory-wide counts. A page remains usable without JavaScript over HTTP and file URLs. Project attribution is optional; metadata appears only when the caller supplies a provider through core or explicit metadata through the legacy facade.

The published core/Plain package pair is not yet released. Use local tarballs for consumer qualification.

Standalone Plain uses explicit generated index filenames for portable no-JavaScript directory links, including breadcrumbs and parent navigation. Set `portableLinks: false` to prefer native directory URLs. The legacy facade retains that native-URL default.
