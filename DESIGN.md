---
name: Dirwell
description: A calm technical catalog for publishing and navigating directories.
colors:
  deployment-blue: "#174ea6"
  deployment-blue-deep: "#103973"
  paper: "#f3f0e8"
  paper-deep: "#e8e3d8"
  ink: "#171815"
  muted-ink: "#64655f"
  catalog-rule: "#c9c5ba"
  status-green: "#34705c"
  terminal: "#20231f"
  focus-blue: "#005fcc"
typography:
  display:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(4.4rem, 8.3vw, 7.2rem)"
    fontWeight: 500
    lineHeight: 0.85
    letterSpacing: "-0.04em"
  headline:
    fontFamily: 'Georgia, "Times New Roman", serif'
    fontSize: "clamp(2.5rem, 5vw, 4.6rem)"
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "1.08rem"
    lineHeight: 1.65
  label:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: "0.78rem"
    fontWeight: 730
    letterSpacing: "0.08em"
rounded:
  control: "12px"
  surface: "14px"
spacing:
  control-x: "20px"
  section-y: "120px"
  page-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.deployment-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.deployment-blue-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "0 20px"
    height: "48px"
---

# Design System: Dirwell

## Overview

**Creative North Star: "The Public Release Index"**

Dirwell uses the visual language of a maintained technical catalog: warm paper,
precise rules, readable metadata, and a restrained deployment blue. The official
site is editorial at the top and increasingly dense as it explains the product.
The generated explorer remains a separate, compact inventory interface that third-party
themes may replace without inheriting the official site's tokens.

**Key Characteristics:**

- Editorial display type leads; interface type carries actions and metadata.
- Real terminal and file-ledger content prove the product instead of decorative imagery.
- Thin rules organize dense information; rounded surfaces are reserved for controls and demonstrations.
- Keyboard focus and reduced-motion behavior are part of the visual system.

## Colors

Deployment Blue carries primary actions and links. Paper and Ink hold almost all
surface area. Status Green is limited to file-type and build-state information.

**The Deployment Blue Rule.** Use the accent to show navigation or action, never as a large decorative field.

## Typography

- **Display Font:** Georgia (with Times New Roman fallback)
- **Body Font:** Inter or the platform sans stack
- **Label/Mono Font:** the body stack for labels; the platform monospace stack for commands and measurements

The serif carries public-facing editorial statements. The sans stack keeps controls,
documentation, and file metadata neutral. Monospace is reserved for commands and data.

**The Ledger Type Rule.** Use tabular numerals for file sizes, dates, and other aligned measurements.

## Layout

The official site uses a centered 1180px container with a 40px desktop gutter and
120px section rhythm. Hero composition is asymmetric: statement left, terminal right,
and the file ledger spanning below. Catalog rows replace equal-weight card grids.
At 850px, paired columns stack. At 560px, the page gutter becomes 14px per side,
actions stack, and only the documentation link remains in the primary navigation.
Wide file metadata may scroll inside the ledger; it must not expand the page.

The default explorer keeps its own compact responsive row layout and high information density.

## Elevation & Depth

Most surfaces are flat and separated by catalog rules. The terminal, file-ledger demo,
and code panel use soft downward shadows to mark them as runnable or inspectable artifacts.
Zero-offset colored halos are not part of the system.

**The Evidence Surface Rule.** Elevation identifies a working example or code artifact, not a generic content container.

## Shapes

Controls use gently rounded 12px corners. Demonstration surfaces use 14px corners.
Content sections and catalog rows remain square and rule-bound. Pills are reserved for
small status controls in the generated explorer.

## Components

### Buttons

- **Primary:** Deployment Blue, white text, 12px radius, 48px minimum height, and 20px horizontal padding.
- **Hover:** shifts to Deployment Blue Deep without movement.
- **Focus:** a 3px Focus Blue outline with 4px offset.

### Catalog Rows

Rows use one thin bottom rule, a strong title, muted description, green technical label,
and direct text links. They do not use card backgrounds or decorative sequence numbers.

### Code Tabs

Tabs share one bordered paper surface. The active tab uses Deployment Blue text and a
2px inset underline. Arrow keys, Home, and End move focus and selection together.

### Default Explorer

The bundled explorer treats a directory as an inventory sheet. The path is the primary
heading; entry metadata forms a calm, high-density ledger. It uses neutral paper and ink,
a restrained link color, tabular numerals, strong keyboard focus, and no external asset dependency.
This implementation demonstrates one theme; it is not the theme API. Themes may replace
components, assets, or the complete document without using the official-site tokens.

## Do's and Don'ts

### Do:

- **Do** show real commands, directory entries, and build modes when explaining capability.
- **Do** keep examples paired with both their live output and source directory.
- **Do** preserve the problem-to-proof-to-setup-to-advanced reading order on marketing surfaces.
- **Do** keep focus visible and motion optional.

### Don't:

- **Don't** turn the page into an equal-card feature grid.
- **Don't** use invented adoption claims, customers, metrics, or testimonials.
- **Don't** use Unicode arrows or emoji as interface icons.
- **Don't** force third-party themes to inherit either the official-site or default-theme palette.
