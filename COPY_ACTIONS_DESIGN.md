# Optional copy actions

## Decision

Add copy actions only as an opt-in feature of the default theme. Keep the plain
theme's native links and selectable text. Place a compact action control on an
eligible file row, revealed on hover and focus but still reachable by keyboard.
Its menu has two explicit choices: **Copy link** and **Copy path**. Do not add
two persistent buttons to every row or another control to the main toolbar.

This document defines the interaction. It does not change the current default
theme or add a public option before the behavior is implemented and tested.

## Values

| Action    | Value                                                                                                                                                                             | Example                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Copy link | Resolve the row's actual navigation `href` against `document.baseURI`, then copy the absolute HTTP(S) URL. This honors relative, `base`, and `html-base` deployments.             | `https://example.com/catalog/reports/a.txt` |
| Copy path | Copy the source-root-relative logical path from `entry.relativePath`, with `/` separators and no leading slash. This is the visible entry's path, including a symlink's own name. | `reports/a.txt`                             |

The path is a repository-relative label. It is not a host URL, a decoded URL
pathname, or a machine-absolute filesystem path. Keep its original filename
characters. Copying a link uses the same destination as opening that row; do
not reconstruct it from `relativePath` because symlinks and output naming can
change the destination.

## Eligibility and safety

- Show actions for files with a usable navigation `href`. Do not show them for
  folders in the first version.
- Suppress actions for outside-root symlinks and other unavailable entries.
  A broken symlink's raw diagnostic view is not the file's public URL, so do
  not offer a copy action there. A usable in-root symlink can copy its own
  logical path and its actual navigation URL.
- Validate the resolved link's protocol as HTTP(S) before copying. Never copy
  `file:` or script URLs through this action. Existing plain link navigation
  remains the source of truth.
- Do not expose `absolutePath`, `resolvedPath`, or a symlink target as a copy
  value. Render all labels and feedback as text, without interpreting entry
  names as HTML.

## Interaction and fallback

1. The row action opens a small menu without activating the file link. Its
   accessible name identifies the file. Escape closes it and returns focus to
   the action. Arrow keys and Tab can reach both choices.
2. Invoke `navigator.clipboard.writeText()` only from the user's chosen action.
   Announce success through a polite live region, naming the value type.
3. If the Clipboard API is absent or rejects, show the exact value in a
   focused, readonly field with a Select button and a close control. Tell the
   user to use the browser's copy command. Do not claim success or silently
   replace the user's clipboard.
4. Keep the feedback visible to screen readers and do not move focus on a
   successful write. A failed write moves focus to the selectable value.

The [Clipboard API specification](https://www.w3.org/TR/clipboard-apis/)
defines `writeText()` as a permission-controlled operation in a secure
context. The [HTML standard](https://html.spec.whatwg.org/multipage/urls-and-fetching.html)
defines the document base URL used by relative links. The fallback avoids
depending on clipboard permissions or an insecure-origin exception.

## Implementation acceptance

Before enabling the option, test all three URL strategies, nested files,
encoded filenames, an in-root symlink, broken and outside-root symlinks, an
HTML-base document, Clipboard API success and rejection, keyboard focus and
feedback, and a narrow viewport. Verify the copied value against the rendered
link and the source-root-relative path in generated output. Keep sorting and
row navigation unchanged.
