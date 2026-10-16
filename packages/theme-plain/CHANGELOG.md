# Changelog

## 0.0.10

### Patch Changes

- Publish local favicon images from File, path and file-URL sources, or reference
  public URLs with optional type, sizes and media attributes. Ledger and Crosswave
  default to the bundled paper-bird icons; Plain has no default icon. Preserve icons
  through folder navigation, History, mounted live responses and static URL policies.
  Keep local inputs out of browser models and retain faviconUrl as a compatible
  URL/false shorthand. Serve supported image formats with matching MIME types.

## 0.0.9

No changes in this release.

## 0.0.8

### Patch Changes

- Synchronize the SDK patch family for the Crosswave row-boundary correction. No public API changes in this package.

## 0.0.7

### Patch Changes

- Remove repeated visible new-tab captions from Plain rows while preserving new-tab behavior and providing a localized accessible description.

## 0.0.6

### Patch Changes

- Show readable sizes without expand controls by default. Keep exact bytes opt-in and omit redundant exact values.

## 0.0.5

### Patch Changes

- Use shared configurable binary/decimal/bytes formatting. Show labeled symlink target and link sizes by default, with native exact-byte disclosures and both/target/entry options. Plain now defaults to readable units; size.units: bytes retains exact-byte presentation.

## 0.0.4

### Patch Changes

- Synchronize the SDK family for the Ledger layout correction. No public API changes in this package.

## 0.0.3

### Patch Changes

- Breaking pre-1.0 API change for the synchronized 0.0.x SDK family.

  Move directory URL policy into shared Core routing with an explicit-filename default. Add slash and clean profiles with coordinated output paths, reference bases, data identities, metadata and live canonical routes. Remove Plain portableLinks and theme filename inference. Reject publication collisions, preserve source homepages, and render unavailable ancestor targets without links. The @dirwell/cli package accepts shared routing and --directory-urls; adapters forward the same contract.

  Clean static pages require a qualified extensionless host with file-first mapping. Live aliases redirect after authorization and preserve query strings; clean routes do not strip literal index.html directory names. Guard Crosswave cross-document transitions behind scripting availability so native no-script navigation remains usable. Update migration, host qualification and theme-context documentation.

## 0.0.2

No changes in this release.

## 0.0.1

First non-prerelease SDK family. Includes validated configuration, publication/selection controls, documented customization and installed-consumer qualification. Keep family versions synchronized; the 0.0.x API may evolve.
