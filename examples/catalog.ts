/** One ordered catalog for the site, documentation, and example builder. */
export const exampleCatalog = [
  {
    slug: "basic",
    name: "Zero config",
    description: "Publish a portable folder with the default settings.",
    detail: "Portable output · no configuration",
  },
  {
    slug: "file-icons",
    name: "Ledger — the default theme",
    description: "Search, sort, and browse a folder with bundled file icons.",
    detail: "Default theme · search and sorting",
  },
  {
    slug: "plain",
    name: "Plain HTML",
    description: "A complete directory listing with native links and no JavaScript.",
    detail: "Plain theme · complete HTML",
  },
  {
    slug: "crosswave",
    name: "Crosswave",
    description:
      "A PSP-inspired crossbar with flowing light and keyboard or controller navigation.",
    detail: "Packaged theme · folder transitions",
  },
  {
    slug: "base",
    name: "A fixed deployment path",
    description: "Share assets across pages and mount the explorer under a known URL prefix.",
    detail: "Shared assets · deployment URLs",
  },
  {
    slug: "default-theme-override",
    name: "Customize Ledger",
    description: "Keep the explorer behavior while changing colors, icons, and its header.",
    detail: "Palette, icons, and component overrides",
  },
  {
    slug: "custom-theme",
    name: "Release catalog",
    description: "Replace the full document with your own HTML and CSS.",
    detail: "Independent renderer · complete HTML",
  },
  {
    slug: "i18n",
    name: "Theme-owned languages",
    description: "Switch English, Traditional Chinese, and Japanese in an independent theme.",
    detail: "Custom theme · language switching",
  },
  {
    slug: "crosswave-categories",
    name: "Your own Crosswave categories",
    description: "Rename and reorder categories, choose icons, and define file-type filters.",
    detail: "Extension and MIME rules · custom icons",
  },
  {
    slug: "dynamic-og",
    name: "Dynamic share images",
    description: "Generate an image for each folder in a small Design kit.",
    detail: "Build-time PNGs · metadata callbacks",
  },
] as const;
