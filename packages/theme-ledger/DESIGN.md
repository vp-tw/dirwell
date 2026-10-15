# Ledger layout and acceptance

Ledger is a compact inventory sheet. Preserve the paper/ink palette and native
file links. This corrects the Svelte migration's layout regression; it does not
introduce a spacious density mode or redesign the other themes.

## Decisions

- Keep the title and breadcrumb header inside the explorer shell and sticky
  above desktop column labels. Removing its stale offset alone would hide the
  gap but lose the established persistent directory context.
- Measure the actual header and column heights after hydration. Wrapped paths,
  branding, source header snippets and viewport changes must update the inset.
  When the header exceeds one quarter of the viewport or 192px, let it scroll
  normally. The toolbar always scrolls normally.
- Without JavaScript, the header scrolls normally and desktop column labels
  stick at the top with no reserved header gap. Native pagination remains usable.
- Ordinary desktop rows are 52px at the default text size. A 44px name/timestamp
  target and small vertical padding provide density without shrinking controls.
  Wrapped names, symlink targets, source rows and optional actions grow naturally.
  Virtualization estimates 52px until measured; measured heights remain authoritative.
- Header and entry columns share tracks and horizontal insets. At 672px and
  below, hide column headings, give the name a full row, and place size and time
  below it. Wrap long content instead of clipping it. Keep the page as the
  vertical scroll owner.

## Acceptance

`test/browser/ledger-layout.spec.mjs` exercises the compiled SDK theme:

1. At 1280px, default single-line rows measure 52–54px and each cell aligns with
   its column label within 1px. Symlink targets increase row height without clipping.
2. After scrolling 800px, the enhanced header starts at 0 and column labels meet
   its lower edge within 1px. Hit testing on both sides of that edge finds the
   header/columns rather than underlying entries.
3. A wrapped header updates the sticky inset; a tall header becomes static.
   At 320px, long mixed Latin/CJK names remain readable, primary name targets
   are at least 44px tall and the page does not overflow horizontally.
4. With over 500 entries, End, Home and ArrowDown focus visible rows below sticky
   context. Existing SSG/MPA search, sorting, History, source customization and
   teardown scenarios continue to pass.
5. Without JavaScript, rows remain compact, column labels stick without a gap,
   and Next still opens the next native HTML page.

Retain desktop, scrolled and narrow screenshots on the PR for human acceptance.
Scripted browser checks do not establish physical touch-device behavior.

## Implementation sources

The active component is `src/Ledger.svelte`; its complete stylesheet is
`src/styles.css`. Build output copies this stylesheet directly instead of layering
SDK overrides over legacy selectors. Header and row markup share a column-track
custom property so configured columns align without specificity overrides.
The repository's `src/theme-default/DESIGN.md` describes the historical facade;
its compact inventory and persistent-context intent informs this SDK layout.

The sticky inset follows the [CSS positioning model](https://www.w3.org/TR/css-position-3/#sticky-pos).
The observer uses the existing [Svelte action lifecycle](https://svelte.dev/docs/svelte/use)
with teardown on component unmount.
