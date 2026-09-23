# Optional file preview evaluation

## Decision

Defer an in-explorer file preview. The current file link opens in a new tab,
which preserves raw-file access and lets the host decide how to serve each
type. There is no observed product requirement that outweighs the additional
fetch, content-type, accessibility, and host-security behavior. Do not add a
preview control in the alpha line without a concrete use case and a hosting
environment in which the boundary can be verified.

This is a product and security decision, not a claim that safe text preview is
impossible. No implementation follow-up issue is warranted yet. Reopen the
decision when users need to inspect files in place and can supply the expected
file types and deployment host.

## Bounded design if revisited

| Concern       | Required boundary                                                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Types         | Begin with UTF-8 plain text and a small explicit allowlist such as `text/plain`, `text/markdown`, and `application/json`. Render all bytes as text. Never render HTML, SVG, PDF, or Markdown as active content inside the explorer. |
| Size          | Limit decoded input to 256 KiB. A `Content-Length` above the limit can fail early, but the fetch must also stop reading after the limit because the header can be absent or incorrect. Reject malformed UTF-8 and binary data.      |
| Loading       | Fetch only after a user opens Preview. Abort on close or navigation. Do not prefetch entries or send file contents to a third-party service. Show loading, too-large, unsupported-type, and network-error states.                   |
| Symlinks      | Resolve through the same in-root navigation policy as raw file links. Suppress preview for broken, outside-root, and cycle targets. Never fetch or display a machine-absolute target path.                                          |
| Navigation    | Preserve the file's original new-tab link and a clear Open raw file action. Preview remains opt-in and never intercepts the link by default.                                                                                        |
| Accessibility | Use a labeled dialog with a text container, initial focus, Escape/close behavior, and focus return. Announce loading and errors without moving focus unexpectedly. Support keyboard scrolling and narrow viewports.                 |
| Host security | Verify response MIME and `Content-Type` on the actual host. Render with text nodes, without `innerHTML`, iframe execution, or remote highlighter assets. Test CSP and `nosniff` behavior on that host.                              |

The current generator and default theme do not control headers on every static
host. [CSP](https://www.w3.org/TR/CSP/) and
[MIME handling](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options)
therefore need host-specific verification. An iframe is not the proposed
preview mechanism: embedding untrusted HTML would introduce a second browsing
context with sandbox and origin rules. Text-node rendering avoids executing
file content in the explorer document, but still requires the size, encoding,
privacy, and response-type limits above.

## Code preview and theme compatibility

Code files could be shown as escaped plain text under the same limit. Syntax
highlighting is deferred: a parser or language bundle adds download and
processing cost, and token colors must work with light, dark, and custom
themes. A future prototype should measure those costs and expose theme-owned
styles instead of importing the official site's design tokens. The plain theme
continues to rely on browser-native file navigation.
