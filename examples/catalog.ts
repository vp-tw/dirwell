type Example = {
  group: "themes" | "guides" | "servers";
  slug: string;
  name: string;
  description: string;
  detail: string;
} & ({ preview: true } | { preview: false; guide: string });

/** One catalog supplies the site; only previewable examples enter the static build. */
export const exampleCatalog = [
  {
    preview: false,
    group: "guides",
    slug: "url-routing",
    name: "Choose directory URLs",
    description: "Compare explicit filenames, directory indexes and extensionless routing.",
    detail: "Core routing · output placement and hosting requirements",
    guide: "urls/",
  },
  {
    preview: true,
    group: "themes",
    slug: "file-icons",
    name: "Ledger",
    description: "Search, sort, and browse a folder with bundled file icons.",
    detail: "Optional Svelte theme · search and sorting",
  },
  {
    preview: true,
    group: "themes",
    slug: "plain",
    name: "Plain",
    description: "Minimal directory HTML with native links, system fonts, and no generated assets.",
    detail: "Included with the CLI · minimal HTML",
  },
  {
    preview: true,
    group: "themes",
    slug: "crosswave",
    name: "Crosswave",
    description:
      "A PSP-inspired crossbar with flowing light and keyboard or controller navigation.",
    detail: "Optional Vue theme · crossbar navigation",
  },
  {
    preview: true,
    group: "guides",
    slug: "base",
    name: "Deploy under a URL prefix",
    description: "Share assets across pages and mount the explorer under a known URL prefix.",
    detail: "Ledger · deployment URLs",
  },
  {
    preview: true,
    group: "guides",
    slug: "default-theme-override",
    name: "Customize Ledger source",
    description: "Keep the explorer behavior while changing colors, icons, and its header.",
    detail: "Ledger · Svelte snippets and custom icons",
  },
  {
    preview: true,
    group: "guides",
    slug: "custom-theme",
    name: "Build an independent theme",
    description: "Replace the full document with your own HTML and CSS.",
    detail: "Independent renderer · complete HTML",
  },
  {
    preview: true,
    group: "guides",
    slug: "i18n",
    name: "Add theme-owned languages",
    description: "Switch English, Traditional Chinese, and Japanese in an independent theme.",
    detail: "Custom theme · language switching",
  },
  {
    preview: true,
    group: "guides",
    slug: "crosswave-categories",
    name: "Customize Crosswave categories",
    description: "Rename and reorder categories, choose icons, and define file-type filters.",
    detail: "Crosswave · category rules and icons",
  },
  {
    preview: true,
    group: "guides",
    slug: "dynamic-og",
    name: "Generate per-folder share images",
    description: "Generate an image for each folder in a small Design kit.",
    detail: "Crosswave · build-time image callbacks",
  },
  {
    preview: false,
    group: "servers",
    slug: "shared-cache",
    name: "Cache a public listing",
    description: "Run two Hono servers that share listing data through Redis.",
    detail: "Node.js and Redis · run locally",
    guide: "server-integrations/#cache-a-public-listing",
  },
] as const satisfies readonly Example[];

/** The same groups drive the homepage and documentation. */
export const exampleGroups = [
  {
    id: "themes",
    name: "Official themes",
    description:
      "Plain comes with the CLI. Install Ledger or Crosswave for search, sorting and keyboard navigation.",
    examples: exampleCatalog.filter(({ group }) => group === "themes"),
  },
  {
    id: "guides",
    name: "Customization and deployment",
    description: "Change colors, languages, file categories, share images or deployment URLs.",
    examples: exampleCatalog.filter(({ group }) => group === "guides"),
  },
  {
    id: "servers",
    name: "Server integrations",
    description: "Run Dirwell inside a Node application and connect it to your services.",
    examples: exampleCatalog.filter(({ group }) => group === "servers"),
  },
] as const;

/** Keep the earlier basic archive URL available without listing a second Ledger demo. */
export const publishedExampleSlugs = [
  ...exampleCatalog.filter(({ preview }) => preview).map(({ slug }) => slug),
  "basic",
];
