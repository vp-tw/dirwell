---
name: Dirwell Crosswave
description: A midnight media shelf with horizontal categories and vertical native file links.
colors:
  azure-top: "#2b4f85"
  azure-bottom: "#091a3a"
  violet-top: "#5c407d"
  violet-bottom: "#241532"
  amber-top: "#704d1a"
  amber-bottom: "#30200b"
  rose-top: "#704055"
  rose-bottom: "#351b29"
  jade-top: "#215e52"
  jade-bottom: "#0b2a28"
  graphite-top: "#424d61"
  graphite-bottom: "#181d28"
  text: "#f7fbff"
  muted: "#edf4fc"
  focus: "#fff"
  selection-start: "#f4f9ff08"
  selection-end: "#f4f9ff04"
  hover-wash: "#eef7ff08"
  active-mark: "#e6f2ff"
  search-line: "#d5e7ff55"
  control-fill: "#0b193b70"
  control-line: "#d7e9ff33"
  open-line: "#e8f1ff88"
typography:
  headline:
    fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif'
    fontSize: "25px"
    fontWeight: 300
    lineHeight: 1.3
    letterSpacing: "-.015em"
  title:
    fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif'
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.4
  body:
    fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif'
    fontSize: "16px"
    lineHeight: 1.5
  label:
    fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif'
    fontSize: "14px"
  metadata:
    fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif'
    fontSize: "11px"
  brand:
    fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif'
    fontSize: "20px"
    fontWeight: 500
    letterSpacing: "-.02em"
rounded:
  focus: "3px"
  control: "4px"
  parent-hover: "5px"
  file-row: "7px"
spacing:
  icon-label: "12px"
  controls: "16px"
  compact-gap: "20px"
  row-gap: "25px"
  rail-gap: "32px"
  header-inset: "48px"
  stage-inset: "72px"
  column-gap: "80px"
  axis-offset: "104px"
components:
  category:
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    padding: "10px 4px"
  category-active:
    textColor: "{colors.focus}"
  file-row:
    textColor: "{colors.text}"
    rounded: "{rounded.file-row}"
    padding: "14px 18px"
  search:
    textColor: "{colors.text}"
    padding: "6px 0"
    width: "220px"
  appearance-select:
    backgroundColor: "{colors.control-fill}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "7px 24px 7px 10px"
  motion-button:
    textColor: "{colors.text}"
    padding: "6px 0"
  open-link:
    textColor: "{colors.text}"
    typography: "{typography.label}"
---

# Design System: Dirwell Crosswave

## Overview

**Creative North Star: "The Midnight Media Shelf"**

Crosswave is an independent, opt-in packaged theme. Its midnight ground, thin white geometric icons, satin light ribbons, and quiet sans labels make a directory read as a media shelf. The user-pinned PSP crossbar interaction places categories on the horizontal axis and files on the vertical axis.

Native file links, source names, link states, and actual metadata remain the content. Broad space separates the selected row from its detail panel. This document records the implemented Crosswave world only; the documentation site, Ledger, and Plain retain their own systems.

**Key Characteristics:**

- Horizontal category rail and vertical file list.
- Six dark ambient palettes with bright text.
- Original inline SVG geometry and procedural light; no shipped raster artwork.
- Visible focus, IME-safe search, reduced motion, and static fallbacks.

## Colors

The primary color is an ambient ground rather than a button accent; six paired dark palettes share the same bright foreground.

### Primary

- **Azure:** default midnight blue ground, with separate upper and lower stops.
- **Violet, Amber, Rose, Jade, Graphite:** selectable alternatives using the same upper/lower structure. The CSS pairs describe the static fallback; the WebGL renderer uses corresponding normalized RGB tint vectors and computes its own light ground.

### Neutral

- **Text:** primary filenames and content.
- **Muted:** secondary labels, metadata, placeholders, and inactive categories. Its name indicates hierarchy; it remains bright for readability.
- **Focus:** outlines and active foreground.
- **Selection start / end and hover wash:** low-opacity white layering over the existing ground.
- **Active mark:** short luminous line beneath the selected category.
- **Search line, control fill / line, open line:** restrained control boundaries.

**The Light Ground Rule.** Keep the foreground bright across every palette and its selected-row wash. Atmospheric ribbons remain behind readable file content.

The review artifacts provide a six-palette all-time composited contrast lower bound of 5.279:1, a fallback lower bound of 4.850:1, and sampled WebGL framebuffer contrast of at least 6.512:1. These bounds describe full-opacity, settled foreground over the shipped palette and compositing; transient transform/opacity exchanges are outside that contrast claim. They are not permission to brighten future ribbons without checking contrast again. Axe reported no violations but could not resolve the canvas background; the separate bounds and framebuffer samples address that gap.

## Typography

**Display and Body Font:** Segoe UI with Helvetica, Arial, and sans-serif fallbacks. This system face is the user-pinned quiet-label material for this theme; it is not a display-font prescription for other Dirwell surfaces.

**Character:** A compact sans hierarchy with light detail titles and readable regular file names. There is no large marketing display role.

### Hierarchy

- **Headline:** selected-file detail title; narrows to 21px at the medium breakpoint.
- **Title:** file name; narrows to 17px in portrait. Names wrap anywhere rather than truncate.
- **Body:** baseline page text.
- **Label:** category names and open action; category labels narrow to 12px in portrait.
- **Metadata:** row status, size, modified date, and keyboard hints.
- **Brand:** project name; narrows to 18px in portrait. The subordinate theme label uses 12px, regular weight, and .08em tracking, then 10px in portrait.

Directory headings are 17px regular (16px in portrait); search is 13px; detail metadata and appearance controls are 12px. The clock uses tabular numerals. Type sizes are role-specific, not a generated modular scale.

## Layout

The desktop stage is capped at 1500px, centered, and uses `minmax(0, 1.55fr) minmax(220px, 1fr)` columns. The category rail spans both columns. Category and file content share the axis offset; details occupy the right column. The rail scrolls horizontally without a visible scrollbar. The list scrolls vertically with a thin scrollbar; the footer stays fixed over a lower-ground gradient.

The medium layout (at or below 1000px) reduces stage padding to 36px, the column gap to 35px, and the axis offset to 44px. The search moves below the directory heading. Portrait (at or below 680px) uses one file column with 16px stage padding, no detail panel, 76px category widths, 33px category icons, and modified dates in each row. Appearance controls and search targets are at least 44px tall. Keyboard hints are hidden; connected-controller status sits above the footer.

Short landscapes (at or below 520px height) also remove the detail panel, show row dates, compact the header and rail, hide the clock, and reduce the footer to a 60px minimum. At or above 1500px width, the rail gap grows to 48px and category minimum width to 112px.

CSS provides initial list bounds. After enhancement, a ResizeObserver measures the header, rail, search heading, and footer; available list height is `max(80, viewport height - list top - footer height - 18)` with a minimum capped at 160px. This keeps the fixed controls clear of focused rows.

**The Two Axes Rule.** Categories move horizontally; file selection moves vertically. Narrow layouts retain both axes.

## Elevation & Depth

Depth comes from the dark directional ground, procedural translucent folds, sparse soft icon shadows, and a very faint selected-row wash. Rows are not raised cards. The fallback uses a radial wash and a 165-degree upper/lower gradient with blurred SVG wave strokes. The WebGL ground has three moving ribbon folds with an added-light cap of .12.

### Shadow Vocabulary

- **Category icon:** `drop-shadow(0 3px 2px #07182a55)`.
- **File icon:** `drop-shadow(0 3px 2px #08192c66)`.
- **File name:** `text-shadow: 0 2px 3px #07192b66`.
- **Detail symbol:** `drop-shadow(0 12px 12px #04152e44)`.
- **Active category mark:** `box-shadow: 0 3px 10px #bddaff55`.

**The Shared Background Rule.** Enhanced directory exchanges move file content inside the persistent shell while the shader canvas, category rail, footer, and controller loop remain mounted. Full-document fallback retains separate background and header view-transition identities.

## Shapes

Built-in thin original SVG icons use a 24-unit viewBox, rounded strokes, and a 1.45 stroke width. Category icons are 40px, row icons 34px, and the detail symbol 110px with a lighter .8 stroke width. Configured rail icons may use trusted decorative SVG markup within the same category dimensions. The active category mark is a short line (24px by 2px). Controls have gently rounded corners; the file selection wash uses the file-row radius. The search and open action use a bottom line instead of a boxed button.

## Components

### Category navigation

Transparent icon-and-label buttons with small count labels. Inactive foreground uses Muted. Hover brightens and moves up 3px; selection brightens, scales to 1.1, and adds the luminous underline. Color changes take 200ms, spatial changes 300ms with the theme easing. The tablist uses roving focus and exposes selection through `aria-selected`.

The default rail remains All files, Folders, Photos, Music, Videos, Documents, and Other. A configured category array replaces the rail; its order, labels, included categories, built-in or trusted decorative SVG icons, and extension/MIME matching rules are caller-controlled. The first configured category is initially selected, and history restores a category only when its identifier exists in the mounted rail. Matching rules may overlap, so an entry may contribute to multiple counts; Other collects non-folder entries unmatched by the configured specific rules. Generation computes membership with Node-side `mime` (4.1.0); the browser filters generated membership identifiers without loading a MIME database.

### File rows and details

Native links remain the activation surface. Each row has an icon, wrapping name, status, optional size/declared target, and compact-layout modified date. Selection adds the translucent gradient, moves the row right 5px, and scales the icon to 1.22. Hover uses the independent hover wash. The detail panel repeats actual selected metadata; its open action is a lined text link with a geometric arrow. Unavailable entries remain visible as text.

Rail customization does not change row or detail icons: directories use folder geometry, symlinks use link geometry, and file icons follow filename-based MIME estimates. For example, the custom Source code rule includes `.ts` explicitly even though the MIME lookup estimates that suffix as `video/mp2t`. Category membership does not inspect file contents or alter served content headers.

### Search

A transparent search field with an inline geometric search icon and bottom stroke. A labeled input, placeholder, and conditional Clear button share one line. Search is local to the current folder. Composition input does not trigger navigation or premature search updates.

### Appearance controls

A small dark translucent select switches among six palettes. The adjacent transparent motion button reports Pause waves, Resume waves, Reduced motion, or Static background. Color and pause preferences are scoped to the explorer root in local storage. Visible focus is a 2px white outline, offset 6px, with the focus radius; search uses a 3px outline offset.

### Theme attribution

Quiet secondary text beneath the project name reads Crosswave by VdustR. The theme name and author are native links to the theme README and author profile, available without JavaScript. Attribution uses Muted foreground, regular secondary-label type (12px), normal letter spacing, and underlined links with a minimum target height (24px). The underline brightens on hover; keyboard focus uses the incumbent white outline. Desktop, portrait, and short landscape keep attribution in the header. The fixed footer retains navigation help, controller status, and appearance controls without a duplicate attribution row; it is hidden before enhancement. Captures in `../../.impeccable/review/header-credits/` show these three layouts. This component record introduces no new tokens or visual world.

### Persistent directory navigation and feedback

Generated classic-script page data supplies each folder on demand in SSG, MPA, and relative local-file output. Enhanced folder links, parent links, breadcrumbs, and Home update the title, location, file list, counts, and selected details inside the mounted shell. Native file actions and modified/new-tab activations retain ordinary link behavior. Category, search query, selected path, and list scroll restore from browser history; recent folder revisits also restore their view state. Local-file navigation keeps the launch document address and records its destination in the hash so history and reload can recover it.

A new request cancels the previous request; an eight-second timeout bounds loading. After 120ms, a fixed status banner above the footer offers Cancel. Escape outside editable controls and the controller back action cancel a pending request. Ordinary loading failures retain the current file list and offer Retry and Open normally; history-load failures recover through native navigation to the requested destination. The banner uses the existing lower-ground color, bright text, control radius, 13px type, and wrapping flex layout, with 44px bordered actions. It remains above the motion layers and uses a polite status role.

A folder whose generated category configuration differs from the mounted rail is rejected by enhanced navigation. The retained-list failure feedback offers Open normally so native navigation can reload that folder's configuration; history failures recover through the same native-navigation path.

### Motion and progressive fallback

Category exchanges enter over 260ms from 12px to the right at .35 opacity. Enhanced directory exchanges overlap a 140ms outgoing snapshot (ease-out, full opacity to zero, 24px opposite the entry direction) with 240ms incoming content (theme easing, .25 opacity to full opacity, 28px to rest). Entering a folder moves incoming content from the right; returning to a parent reverses both movements. Browser history direction follows the history position. These exchanges use transform and opacity without blur. Outgoing browser snapshots clone only visible rows, preserve their scroll positions, and clip to the viewport above the footer. Snapshots are inert, hidden from assistive technology, and removed on completion or cancellation.

Full-document fallback retains the native 180ms exit (22px left, 3px blur) and 420ms entry (32px right, 5px blur). Its background snapshots use 420ms and header snapshots 240ms. Cross-document transitions depend on browser support and same-origin navigation; ordinary links remain available when the persistent navigator cannot handle a route or history is restricted.

Reduced motion removes animations/transitions, smooth scrolling, and selected/hover transforms. Pausing freezes the existing procedural frame. Hidden pages stop wave and controller polling; pagehide stops them, and BFCache pageshow resumes them. Wave drawing is capped near 30fps; backing resolution is capped by device ratio 1.5 and 1600 by 1000. WebGL failure or context loss reveals the static gradient and SVG wave.

Without JavaScript, the complete native file listing remains available; category/search/appearance/controller enhancements remain hidden and list height is unbounded. Keyboard and standard-mapped gamepad snapshots share category/file navigation. Synthetic Chromium tests establish handler behavior; USB/Bluetooth and physical controllers remain unverified.

## Do's and Don'ts

### Do:

- **Do** preserve native links, real filenames, and explicit symlink states.
- **Do** use the horizontal rail and vertical file column at every screen size.
- **Do** preserve the white focus outline and the reduced-motion/static fallbacks.
- **Do** keep this palette, type stack, and motion vocabulary scoped to Crosswave.

### Don't:

- **Don't** add copied console artwork, simulated system indicators, or autoplay audio.
- **Don't** replace the procedural ribbon with a shipping raster asset.
- **Don't** hide file reachability behind the detail panel or controller support.
- **Don't** claim physical controller support was verified by synthetic handler tests.

Not canonized or repaired: no implementation defect is promoted into a token. The theme's intentional system-sans and ambient-color boundary does not redefine the root system. Hardware controller activation remains a verification limit.

Source of truth: `styles.ts`, `icons.ts`, `categories.ts`, `../theme-crosswave.ts`, and `../crosswave-runtime.js`. Original review captures and contrast artifacts are in `../../.impeccable/review/crosswave/`. Persistent-shell desktop, portrait, short-landscape, error, and entry/return motion captures are in `../../.impeccable/review/seamless/`; the independent follow-up review resolved the bounded-overlays finding and returned ship. Custom-category desktop, portrait, and short-landscape captures are in `../../.impeccable/review/categories/`; they retain the existing Jade palette and both navigation axes. These captures do not establish physical-controller behavior or content-based MIME detection.
