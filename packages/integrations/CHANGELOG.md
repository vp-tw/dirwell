# Changelog

## 0.0.4

### Patch Changes

- Synchronize the SDK family for the Ledger layout correction. No public API changes in this package.
- Updated dependencies
  - @dirwell/core@0.0.4

## 0.0.3

### Patch Changes

- Breaking pre-1.0 API change for the synchronized 0.0.x SDK family.

  Move directory URL policy into shared Core routing with an explicit-filename default. Add slash and clean profiles with coordinated output paths, reference bases, data identities, metadata and live canonical routes. Remove Plain portableLinks and theme filename inference. Reject publication collisions, preserve source homepages, and render unavailable ancestor targets without links. The @dirwell/cli package accepts shared routing and --directory-urls; adapters forward the same contract.

  Clean static pages require a qualified extensionless host with file-first mapping. Live aliases redirect after authorization and preserve query strings; clean routes do not strip literal index.html directory names. Guard Crosswave cross-document transitions behind scripting availability so native no-script navigation remains usable. Update migration, host qualification and theme-context documentation.

- Updated dependencies
  - @dirwell/core@0.0.3

## 0.0.2

### Patch Changes

- Updated dependencies [7044c88]
  - @dirwell/core@0.0.2

## 0.0.1

First non-prerelease SDK family. Includes validated configuration, publication/selection controls, documented customization and installed-consumer qualification. Keep family versions synchronized; the 0.0.x API may evolve.
