# Unplugin integration evaluation

## Decision

Do not add an unplugin adapter to the alpha package. Use `generateExplorer()`
from a build script when a host owns the build, or use the `dirwell build` and
`dirwell serve` commands when Dirwell owns it. A Vite build hook can call the
generator, but that alone does not provide a complete development integration.
Create a separate adapter issue when a real host integration needs its own
serving, watching, and output ownership contract.

## Evidence

The repository's `scripts/build-examples.ts` calls the CLI for five independent
examples. `generateExplorer()` is also a public API. It stages output and then
replaces the entire output directory, so sharing that directory with a host
bundler could erase the host's files or be erased by the host. The CLI's serve
path already watches the source tree, queues overlapping rebuilds, serves its
own output, and reloads clients. A host adapter would need to replace those
responsibilities rather than start a second watcher and server.

A local proof of concept used the installed Vite package's `build()` API and a
`buildStart` plugin hook that awaited `generateExplorer({ sourceDir, outputDir })`.
Vite finished a separate application build, and Dirwell produced both an index
page linking to `README.txt` and the mirrored file. This proves the build-time
call works. It does not prove dev serving, change handling, or other hosts.

The [Unplugin guide](https://unplugin.unjs.io/guide/) lists common hooks but
does not provide `watchChange` on esbuild or Bun, and `addWatchFile` is not
available on esbuild. [Vite's plugin API](https://vite.dev/guide/api-plugin)
has dev-server and hot-update hooks that are specific to Vite. Those differences
matter for a directory generator that must react to added and deleted files,
not only transformed modules.

## Integration boundary

| Concern        | Current API or CLI                                                            | Required adapter contract                                                                                           |
| -------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Build output   | `generateExplorer()` owns a dedicated `outputDir` and replaces it atomically. | Keep the output outside the host's managed output, or define one owner and a safe merge step.                       |
| Watch events   | `dirwell serve` watches recursively and serializes rebuilds.                  | Observe file creation, deletion, rename, and changes through the host; coalesce events and serialize full rebuilds. |
| Dev serving    | The CLI serves generated pages and reloads its own clients.                   | Mount generated pages at an explicit path in the host server and choose one reload mechanism.                       |
| Base URLs      | `base` and `urlStrategy` control links and assets.                            | Map the host's public base to Dirwell's base without assuming that the host's asset path is equivalent.             |
| Rebuild errors | The CLI keeps the last successful output.                                     | Preserve that behavior and expose the failure in the host's diagnostics.                                            |
| Lifecycle      | The CLI closes its watcher and server together.                               | Close adapter resources when the host stops or restarts; avoid a second persistent server.                          |

The minimal public API for a future adapter would be `GenerateOptions` plus a
host mount path and output ownership policy. It should first support one named
host with a real user case. Vite is the only host exercised here. Rollup,
webpack, Rspack, esbuild, and other Unplugin targets remain unverified; a
single build hook is insufficient evidence for support claims.
