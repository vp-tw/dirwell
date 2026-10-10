# Experience design

The interaction sections below describe Ledger. Plain provides complete no-script HTML; Crosswave owns its crossbar, local search, and persistent navigation. See the [theme guide](https://vp-tw.github.io/dirwell/themes/) for their different capabilities.

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
- Ledger shows concise absolute dates in the viewer's local time zone after
  its runtime loads, consistently in static rows, virtualized rows, and global
  search. Activate a date to see the exact local offset and UTC instant.
  Generated HTML and no-JavaScript output explicitly show UTC; Plain stays UTC.
  Sorting uses the underlying instant. Themes own their date presentation.

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
- Unavailable symlinks participate in keyboard navigation through their
  declared-target raw-text view; this does not open the target file.
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

### Localization

Localization belongs to each renderer. Built-in themes stay English; the
`examples/i18n` theme demonstrates language switching, plural messages, and
date/size formatting without adding a core localization setting.

## Shared page metadata and fonts

The three built-in themes use bundled Source fonts and one static whole-site share image by default. Titles identify the site and folder path; descriptions order folders, files, and links. Image callbacks can use per-folder counts and run only at build time. Crosswave updates managed metadata on folder exchanges and history restoration. See [the metadata guide](https://vp-tw.github.io/dirwell/metadata/).

## Decisions for production

- Confirm the supported browser floor before choosing normalization and
  international fuzzy-matching behavior.
