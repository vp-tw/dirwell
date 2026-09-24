---
name: Dirwell Default Explorer Theme
description: A compact inventory sheet for navigating published files.
colors:
  accent-light: "#174ea6"
  paper-light: "#f3f0e8"
  surface-light: "#fbfaf6"
  ink-light: "#171815"
  muted-light: "#64655f"
  rule-light: "#c9c5ba"
  focus-light: "#005fcc"
  accent-dark: "#91bff0"
  paper-dark: "#11130f"
  surface-dark: "#191b17"
  ink-dark: "#f2f0e8"
  muted-dark: "#b1b4ab"
  rule-dark: "#474a42"
  focus-dark: "#78b7f4"
typography:
  body:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "15px"
    lineHeight: 1.45
  metadata:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.82rem"
  control-label:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.76rem"
  column-label:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.68rem"
  badge:
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.72rem"
  target:
    fontFamily: "ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.8rem"
rounded:
  key: "0.2rem"
  segment: "0.34rem"
  control: "0.5rem"
  menu: "0.75rem"
  shell: "0.875rem"
  badge: "999px"
spacing:
  control-height: "2.75rem"
  row-height: "3.25rem"
---

# Design System: Dirwell Default Explorer Theme

## Overview

**Creative North Star: "The Inventory Sheet"**

This is an operational interface. Paths and files are the subject; controls stay
familiar, compact, and quiet. The theme self-hosts selected vscode-icons SVGs
for common file types and a generic fallback. Controls retain quiet line icons.
It is one implementation of Dirwell's theme API, not a visual contract for
third-party themes. The official site's design system lives in the repository
root `DESIGN.md`.

## Colors

Paper and surface separate the page from the file list. Ink carries names;
muted ink carries metadata. The accent identifies navigable paths and active
sort state. File artwork identifies formats; warning orange identifies
broken links. Every semantic role has light and dark values in `styles.ts`.

**The Path Accent Rule.** Use the accent for navigation and active state, not
decoration. Keep unavailable links visibly distinct from usable ones.

## Typography

One system sans family carries controls, paths, and metadata. Tabular numerals
keep sizes and timestamps steady in the ledger. Use monospace only for symlink
targets and key-like data, not as a general technical motif. The path is the
document's semantic heading, visually represented by the breadcrumb trail.

## Layout

The shell is at most 72rem wide. Desktop rows use path, size, and modified-time
columns. At 60rem, the toolbar stacks without changing control order. At 42rem,
rows put metadata below the path, the shell fills the viewport, and shortcuts
precede project metadata in the footer. At 19.5rem, controls may stack again.
Content must not cause horizontal page scrolling at 320px or wider.

The breadcrumb header stays visible while the directory scrolls. On desktop,
column labels stay below it after the toolbar scrolls away; on narrow screens,
column labels are hidden and only the breadcrumb header sticks. The toolbar is
never sticky because its wrapped controls would consume too much mobile height.
The sticky offset follows the actual header height when long paths wrap, and
keyboard navigation positions rows below the fixed information.
If a deeply nested path makes the header taller than a quarter of the viewport
or 12rem, it scrolls normally rather than covering the file list.

Controls use the shared `--dw-control-height` token. Search, selects, Sort,
breadcrumb links, and interactive file names retain a
44px minimum target on touch-sized screens. Column-sort headings use a 44px
minimum target whenever they are buttons.

## Elevation & Depth

Thin rules organize the ledger. The desktop shell and open Sort menu use soft
downward shadows; the edge-to-edge mobile shell has no shadow. Focus uses a
clear outline, not elevation.

## Shapes

Controls have gently rounded corners. The shell has a slightly larger radius
on desktop, while rows remain square and rule-bound. Small status badges may
use a pill shape; file entries do not become cards.

## Components

`components.ts` owns the default HTML components and private select renderer.
`styles.ts` owns the theme's visual rules. `theme-default.ts` composes them and
exposes the public `createDefaultTheme` entry point. Consumers can replace
named components through the theme API or replace the complete theme.

- **Toolbar:** native search input, three independent checkboxes presented as
  one joined toggle group for folder, file, and link types. `details` handles
  sorting; a labeled select handles the theme setting. Keep visible focus and
  one control height.
- **Breadcrumbs:** linked ancestors, plain-text current segment, and a single
  separator between segments.
- **Entry list:** linked names, explicit symlink targets and availability,
  metadata aligned by column on wide screens and by row on narrow screens.
- **Large directories:** MPA pages over the virtualization threshold load a
  per-directory asset. Render only the visible window; measure actual row
  heights and preserve the scroll anchor across wrapping or viewport changes.
- **Global search:** the dedicated search dialog preserves directory context.
  Fetch the sharded index after input, keep results bounded, and announce
  progress and failures in the dialog.
- **Footer:** project attribution and keyboard help remain separate groups;
  narrow screens place shortcuts before attribution. Third-party notices remain
  linked without making icon licensing the main footer label.

## Do's and Don'ts

- **Do** retain native control semantics and keyboard operation.
- **Do** test light, dark, and system appearance at narrow and wide sizes.
- **Do** preserve readable long names and symlink targets.
- **Do** keep unavailable targets distinct while letting their symlink names open the declared target text.
- **Don't** make custom themes inherit this palette or layout.
