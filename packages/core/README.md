# @dirwell/core

Private workspace prototype. Do not publish this package until consumer and platform qualification is complete.

Core owns filesystem selection, safe navigation, public listing projection and static publication. It requires an explicit theme and does not load a default theme, image renderer, frontend framework, config loader or watcher. The only runtime npm dependency is picomatch.

`generateExplorer` publishes a dedicated output tree. `listing` independently plans HTML pages and data blocks; a synchronous callback can select plans per directory. Metadata rendering is an injected Node-side provider. `createDirectoryService` performs live, one-directory reads without writing a generated tree. With filters, selection still walks physical names to preserve descendant inclusion; it is not a constant-cost indexed database query.

The service rejects dot segments, absolute paths, backslashes, reserved root paths and paths outside the physical root. Symlink metadata retains existing declared-target behavior. Node-side entries are private inputs; use `projectListingEntry` before public serialization. Reads are not a transactional filesystem snapshot and are not qualified against adversarial concurrent directory replacement.
