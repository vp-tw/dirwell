# Changelog

## 0.0.10

No changes in this release.

## 0.0.9

No changes in this release.

## 0.0.8

### Patch Changes

- Synchronize the SDK patch family for the Crosswave row-boundary correction. No public API changes in this package.

## 0.0.7

### Patch Changes

- Synchronize the SDK patch family for the Plain new-tab hint correction. No public API changes in this package.

## 0.0.6

### Patch Changes

- Synchronize the SDK family for the official-theme size display correction. Raw byte data and numeric sorting remain unchanged.

## 0.0.5

### Patch Changes

- Expose optional browser-safe byte formatting and size selection through @dirwell/core/format. Preserve raw byte fields and add explicit targetSize sorting; non-comparable sizes follow numeric values in either direction.

## 0.0.4

### Patch Changes

- Synchronize the SDK family for the Ledger layout correction. No public API changes in this package.

## 0.0.3

### Patch Changes

- Breaking pre-1.0 API change for the synchronized 0.0.x SDK family.

  Move directory URL policy into shared Core routing with an explicit-filename default. Add slash and clean profiles with coordinated output paths, reference bases, data identities, metadata and live canonical routes. Remove Plain portableLinks and theme filename inference. Reject publication collisions, preserve source homepages, and render unavailable ancestor targets without links. The @dirwell/cli package accepts shared routing and --directory-urls; adapters forward the same contract.

  Clean static pages require a qualified extensionless host with file-first mapping. Live aliases redirect after authorization and preserve query strings; clean routes do not strip literal index.html directory names. Guard Crosswave cross-document transitions behind scripting availability so native no-script navigation remains usable. Update migration, host qualification and theme-context documentation.

## 0.0.2

### Patch Changes

- 7044c88: Add local body/headline font injection for deterministic share images and opt-in bounded live name/path archive queries with Ledger and Crosswave search dialogs.

## 0.0.1

First non-prerelease SDK family. Includes validated configuration, publication/selection controls, documented customization and installed-consumer qualification. Keep family versions synchronized; the 0.0.x API may evolve.
