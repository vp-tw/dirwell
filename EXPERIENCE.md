# Experience design

## Implemented

### Appearance

- Optional System, Light, and Dark control.
- The selected scheme persists across directories and reloads.
- The static document declares its color-scheme before runtime initialization.
- Theme storage failure does not block navigation.

### Search

- Optional fuzzy subsequence matching across entry names and symlink targets.
- Consecutive and word-boundary matches rank higher.
- Result count, empty state, and polite live-region announcement update together.
- Composition input does not filter or reorder entries until `compositionend`.
- The query is scoped to the current pathname and survives watch reloads for the
  browser session.

### Keyboard

- `/` focuses search outside an editable control.
- Escape clears search and restores the original order.
- Arrow Up, Arrow Down, Home, End, `j`, and `k` move among visible usable links.
- Backspace navigates to the parent outside editable controls. At the root it
  becomes a no-op.
- Modifier shortcuts and IME key events, including key code 229, are ignored.
- Unusable symlinks are excluded from keyboard navigation.
- Destinations without a generated explorer page open in a new tab with opener
  isolation. Explorer-to-explorer directory navigation stays in the current
  tab, including canonical links used to represent symlink cycles.

### Orientation

- Every generated directory has a semantic breadcrumb. Each ancestor is a
  same-tab link; the current directory uses `aria-current="page"`.

### Progressive enhancement

- Directory links, metadata, symlink status, and parent navigation work without
  JavaScript.
- Each interactive feature can be disabled independently in
  `createDefaultTheme()`.
- The development-only live-reload client is injected by the dev server and is
  absent from deployable output.

## Candidate follow-up

1. Add explicit Name, Size, and Modified sorting while preserving the scanner's
   deterministic default order.
2. Add copy-path and copy-link actions with success feedback and secure-context
   fallback behavior.
3. Add localization as a renderer concern, including plural rules and date/size
   formatting.
4. Add a large-directory strategy after measuring representative trees; choose
   chunked DOM rendering or virtualization from evidence.
5. Add optional file previews only after defining size, MIME, privacy, and
   content-security boundaries.

## Decisions for production

- Confirm whether interactive controls are default-on or selected through a
  named theme variant.
- Confirm whether the runtime asset is emitted per directory in SSG mode or
  shared from the output root in MPA mode.
- Confirm the supported browser floor before choosing normalization and
  international fuzzy-matching behavior.
