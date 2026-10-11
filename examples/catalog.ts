/** Visitor-facing examples: compare themes before exploring customization. */
export const exampleCatalog = [
  {
    group: "themes",
    slug: "file-icons",
    name: "Ledger (default)",
    description: "Search, sort, and browse a folder with bundled file icons.",
    detail: "Built-in theme · search and sorting",
  },
  {
    group: "themes",
    slug: "plain",
    name: "Plain",
    description: "Minimal directory HTML with native links, system fonts, and no generated assets.",
    detail: "Built-in theme · minimal HTML",
  },
  {
    group: "themes",
    slug: "crosswave",
    name: "Crosswave",
    description:
      "A PSP-inspired crossbar with flowing light and keyboard or controller navigation.",
    detail: "Built-in theme · crossbar navigation",
  },
  {
    group: "guides",
    slug: "base",
    name: "Deploy under a URL prefix",
    description: "Share assets across pages and mount the explorer under a known URL prefix.",
    detail: "Ledger · deployment URLs",
  },
  {
    group: "guides",
    slug: "default-theme-override",
    name: "Customize Ledger components",
    description: "Keep the explorer behavior while changing colors, icons, and its header.",
    detail: "Ledger · palette and icon overrides",
  },
  {
    group: "guides",
    slug: "custom-theme",
    name: "Build an independent theme",
    description: "Replace the full document with your own HTML and CSS.",
    detail: "Independent renderer · complete HTML",
  },
  {
    group: "guides",
    slug: "i18n",
    name: "Add theme-owned languages",
    description: "Switch English, Traditional Chinese, and Japanese in an independent theme.",
    detail: "Custom theme · language switching",
  },
  {
    group: "guides",
    slug: "crosswave-categories",
    name: "Customize Crosswave categories",
    description: "Rename and reorder categories, choose icons, and define file-type filters.",
    detail: "Crosswave · category rules and icons",
  },
  {
    group: "guides",
    slug: "dynamic-og",
    name: "Generate per-folder share images",
    description: "Generate an image for each folder in a small Design kit.",
    detail: "Crosswave · build-time image callbacks",
  },
] as const;

/** The same groups drive the homepage and documentation. */
export const exampleGroups = [
  {
    id: "themes",
    name: "Built-in themes",
    description:
      "Choose an interface: Ledger is the default; Plain and Crosswave are alternatives.",
    examples: exampleCatalog.filter(({ group }) => group === "themes"),
  },
  {
    id: "guides",
    name: "Customization and deployment",
    description:
      "These examples extend or configure a theme; they are not additional built-in themes.",
    examples: exampleCatalog.filter(({ group }) => group === "guides"),
  },
] as const;

/** Keep the earlier basic archive URL available without listing a second Ledger demo. */
export const publishedExampleSlugs = [...exampleCatalog.map(({ slug }) => slug), "basic"];
