# @vp-tw/dirwell

## 0.1.0-alpha.10

### Patch Changes

- Add shared page metadata, static theme share images, bundled Source fonts, and a dynamic per-folder image example. Count folders, files, and symlinks separately, update Crosswave metadata during navigation, and prevent mirrored directory aliases from overwriting target pages.

## 0.1.0-alpha.9

### Patch Changes

- Move Crosswave theme and author links into the header and remove the duplicate footer attribution, leaving more room for files on narrow screens.

## 0.1.0-alpha.8

### Patch Changes

- Add Crosswave theme and author links to the footer, including mobile and no-JavaScript listings. Keep navigation notices above the footer as its height changes.

## 0.1.0-alpha.7

### Minor Changes

- Make Crosswave categories configurable with ordered labels, decorative icons, overlapping extension/MIME filters, and exported default definitions. Infer filename types with the pinned Node-only MIME database; generated browser assets contain membership IDs without the database. Add a runnable custom-category example and configuration documentation.

## 0.1.0-alpha.6

### Minor Changes

- Keep Crosswave's background and controls alive while directory contents slide in opposite directions for entry and return. Generated navigation assets support SSG/MPA, custom URLs, static hosting, build adapters, and relative local HTML. Restore browsing state through history and handle cancelled, superseded, unavailable, incompatible, restricted, and timed-out loads with usable recovery controls.

## 0.1.0-alpha.5

### Patch Changes

- Handle rejected cross-document transition readiness when the browser skips or interrupts an animation, retaining native navigation without an unhandled Promise rejection.

## 0.1.0-alpha.4

### Minor Changes

- Add the opt-in Crosswave theme with a PSP-inspired category rail, animated light ribbons, directory transitions, responsive file navigation, keyboard controls, and standard gamepad support. Include a live media-library example and document configuration and fallback behavior.

## 0.1.0-alpha.3

### Patch Changes

- Keep the bundled attribution link usable outside a repository checkout and align the API documentation with declared-target symlink navigation.

## 0.1.0-alpha.2

### Patch Changes

- Document published-package onboarding, selective build-tool support, troubleshooting, and current alpha release procedures. Lead the README and docs with a working folder-to-website path before advanced configuration.

## 0.1.0-alpha.1

### Patch Changes

- Add a main-only alpha release workflow with npm trusted publishing, artifact integrity and provenance readback, registry consumer verification, and GitHub prerelease creation.

## 0.1.0-alpha.0

### Minor Changes

- 9f2fdce: Initial alpha release with the CLI, SSG/MPA generation, safe symlink handling, source filters, Ledger and Plain themes, all Unplugin build hosts, and typed rendering APIs. Includes a theme-owned English, Traditional Chinese, and Japanese example and concise local dates with exact-time disclosure.
