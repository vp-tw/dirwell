# Size presentation

## Contract and ownership

Core publishes raw bytes. `ListingEntry.size` continues to describe the entry
itself, including a symbolic link's own size. `link.targetSize` describes an
allowed target when available. Neither field contains formatted text or a
recursive directory total. Filesystem failures retain existing error behavior;
a missing target size does not mean an ordinary file was successfully read
without a size.

`@dirwell/core/format` is an optional, browser-safe public entry point. Independent
themes may use `formatBytes` and `sizeValue`, or render raw values themselves.
It imports no Node runtime modules and imposes no markup or theme configuration.
There is no separate formatting package or mandatory formatting pipeline.

Official themes share formatting defaults but own layout. Their internal markup
helper is not the public custom-theme API. The historical compatibility facade
is outside this change.

## Defaults and options

Official factories accept the same serializable `size` options:

```ts
createPlainTheme({
  size: {
    units: "binary", // binary | decimal | bytes
    symlink: "both", // both | target | entry
    exact: "none", // none (default) | details | inline
  },
});
```

- Binary prefixes use powers of 1024; decimal prefixes use powers of 1000.
- Converted values default to at most three significant digits without trailing
  zeros. `maximumFractionDigits` (0–6) instead selects a fractional-digit cap.
- Unconverted bytes and bytes mode preserve the full integer.
- Locale defaults to the theme locale, then `en-US`; `size.locale` overrides it.
  Node and browser receive the same explicit locale.
- Sizes are non-interactive, human-readable text by default. Raw bytes support
  sorting and custom themes; they do not require a visitor control.
- Exact values are explicit publisher opt-ins: native disclosure or inline.
  Only values that differ from the visible text are added. Small byte counts,
  zero and bytes mode never create redundant details or repeated inline values.
- These are publisher settings, not a new visitor preference menu.

Known byte counts must be non-negative safe integers. Formatter inputs outside
that range fail explicitly. The formatter does not invent a missing-value label.

## Symbolic links and unavailable values

Both mode puts `Target` first and `Link` second. Single modes retain the label,
so a reader can identify the object's size even when only one value is shown.
Ordinary files need no repeated object label.

A known empty file is `0 B`. A directory is `Folder`, not zero or an unknown
content total. An available directory link shows `Target Folder` and its own
link bytes in both mode. Missing, inaccessible, outside-root and excluded file
targets never fall back silently to the link size. The current public metadata
cannot reliably distinguish every filesystem failure, so the UI says
`Unavailable` rather than inventing a cause. Even a supplied numeric target size
is withheld when `link.unavailable` is true.

## Sorting

Formatting and display mode never mutate the data or silently change ordering.
`sort.field: "size"` retains entry-size sorting; the Ledger control calls it
`Item size`. `sort.field: "targetSize"` compares regular files by their bytes
and links by allowed target-file bytes; the control calls it `Target size`.
The new field works in builds, live service, published manifests, browser
sorting and shared URL/History controls. Unknown and non-comparable values sort
after numeric values in either direction, subject to the existing folders-first
policy. Equal numeric values retain the existing name tie-breaker.

## Theme interaction and layout

- Plain stays script-free, including opt-in native HTML disclosures. Metadata is not
  inserted as an interactive descendant of a file link.
- Ledger right-aligns size values and keeps ordinary desktop rows at
  the existing compact height. Link labels, target paths and expanded exact
  values may grow naturally. The sticky header remains unchanged.
- Crosswave keeps file navigation and size disclosure separate. Its detail pane
  can repeat the selected entry's size; opt-in exact values remain available on
  narrow screens and without browser JavaScript.
- Native Enter/Space disclosure activation must not trigger file opening or
  global navigation shortcuts. Values wrap without horizontal page overflow.
  Visible labels remain meaningful without color or hover.

## Acceptance

1. Public installed-package imports and browser bundling work without filesystem
   modules. An independent theme can render raw bytes or call the formatter.
2. Unit and precision tests cover zero, both bases, exact bytes, locale, trailing
   zeros, rounding across a unit boundary, large safe integers and rejected input.
3. All official themes render the same values for the same settings in SSG and
   MPA. Tests cover both/target/entry, exact modes and bytes/decimal/binary.
4. Target/entry sorting agree across Node and browser, including unavailable
   targets, directory targets, ascending/descending and equal rounded values.
5. Default output has no size disclosures or duplicate exact values, including
   files, zero and unavailable links. Opt-in details add new information only;
   mixed symlink values do not repeat already-exact byte counts. Keyboard Enter
   and Space work without navigation; no-JavaScript output remains usable.
6. Desktop and 320px screenshots cover ordinary files, zero, file links and
   unavailable links. Ordinary Ledger rows and sticky/header regression tests
   still pass; expanded values remain in measured row flow.
7. Packed-consumer checks exercise the public export. Docs show a custom-theme
   call and shared official settings. Physical touch and screen-reader behavior
   remain unverified unless actually exercised.

## Deferred capabilities

Recursive folder totals, allocated disk usage, transfer/compressed size, remote
probes and background progress are separate opt-in features. They require their
own measurement, disclosure, budget, link-counting and freshness contracts;
none is inferred from a directory's filesystem size or performed by a theme.
