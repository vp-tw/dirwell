# Directory URL policies

This example targets the next SDK release or the built checkout, not published 0.0.2.
From the repository root, generate each policy into its own dedicated tree:

```sh
node examples/url-routing/build.mjs explicit ./generated-url-explicit
node examples/url-routing/build.mjs slash ./generated-url-slash
node examples/url-routing/build.mjs clean ./generated-url-clean
```

The JSON report records the actual output path and public path of each directory
entry. Explicit writes `folder/index.html` and links to it. Slash uses the same
file with `folder/` links. Clean writes `folder.html` and links to `folder`, while
the original download remains `folder/note.txt`. Native pagination writes real
page files. The owned homepage keeps its contents and has an explicit explorer
fallback beside it.

Open the explicit root through `file://` for Plain's native no-JavaScript use.
Serve the other trees with their required directory-index or extensionless
mapping. Do not assume a generic file server maps clean URLs, or that a 200 SPA
fallback is the correct page. Test both `/` and a mounted prefix with the full
navigation and download checklist in the [URL guide](../../docs/src/content/docs/urls.md).

For a collision negative case, make a disposable copy of the input, add a real
`folder.html` download and call `generateExplorer` with clean routing on that
copy. It must reject the output collision and preserve the last successful
publication. Do not rename or overwrite the download to make a URL policy fit.
