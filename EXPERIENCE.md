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
- Optional global search loads its index after the user enters a query. It
  searches names, relative paths, and symlink targets across the published tree.
- Physical folders, physical files, and symlinks can be filtered independently
  in local and global search.

### Sorting

- Optional Name, Size, and Modified controls can change field and direction.
  Name sorting offers Unicode, locale-aware, and natural numeric comparison.
- Directory grouping is independent of sort direction. The chosen controls
  persist across directories and reloads; the configured sort sets the initial
  order.

### Large directories

- The default theme emits complete listing HTML in SSG mode. With its default
  settings, MPA directories above 500 entries use a per-directory data asset
  and a measured virtual list when the default row components are present. The
  threshold is configurable.
- These large MPA listings require JavaScript. Filtering and sorting use a Web
  Worker when available, with a main-thread fallback.

### Keyboard

- `/` focuses search outside an editable control.
- Escape clears search and restores the original order.
- Arrow Up, Arrow Down, Home, End, `j`, and `k` move among visible usable links.
- Backspace navigates to the parent outside editable controls. At the root it
  becomes a no-op.
- Modifier shortcuts and IME key events, including key code 229, are ignored.
- Broken symlinks participate in keyboard navigation through their raw-text
  view. Outside-root symlinks remain excluded.
- Destinations without a generated explorer page open in a new tab with opener
  isolation. Explorer-to-explorer directory navigation stays in the current
  tab, including canonical links used to represent symlink cycles.

### Orientation

- Every generated directory has a semantic breadcrumb. Each ancestor is a
  same-tab link; the current directory uses `aria-current="page"`.

### Progressive enhancement

- Directory links, metadata, symlink status, and parent navigation work without
  JavaScript in SSG and smaller MPA listings. Large virtualized MPA listings
  still show breadcrumbs and parent navigation, but need JavaScript for rows.
- Each interactive feature can be disabled independently in
  `createDefaultTheme()`.
- The development-only live-reload client is injected by the dev server and is
  absent from deployable output.

## Candidate follow-up

1. Add copy-path and copy-link actions with success feedback and secure-context
   fallback behavior.
2. Add localization as a renderer concern, including plural rules and date/size
   formatting.
3. Add optional file previews only after defining size, MIME, privacy, and
   content-security boundaries.

## Decisions for production

- Confirm the supported browser floor before choosing normalization and
  international fuzzy-matching behavior.
