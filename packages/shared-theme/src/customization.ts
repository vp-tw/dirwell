import { validateByteFormatOptions, type ByteFormatOptions } from "../../core/src/format.ts";
/** Small serializable inputs shared by official themes; layout stays theme-owned. */
export const defaultLabels = {
  other: "other",
  crosswaveKeyboardHelp: "Arrow keys navigate · Enter confirms · Backspace returns",
  brokenLink: "broken link",
  unavailableLink: "unavailable link",
  cycleLink: "cycle link",
  azure: "azure",
  violet: "violet",
  amber: "amber",
  rose: "rose",
  jade: "jade",
  graphite: "graphite",
  allFiles: "All files",
  categoryFolders: "Folders",
  categoryPhotos: "Photos",
  categoryMusic: "Music",
  categoryVideos: "Videos",
  categoryDocuments: "Documents",
  categoryOther: "Other",
  indexOf: "Index of {path}",
  home: "Home",
  breadcrumb: "Breadcrumb",
  archive: "File archive",
  searchDirectory: "Search this directory",
  searchFiles: "Search files",
  search: "Search",
  types: "Types",
  directory: "directory",
  file: "file",
  link: "link",
  folder: "Folder",
  sort: "Sort",
  name: "Name",
  size: "Size",
  targetSize: "Target size",
  entrySize: "Item size",
  sizeTarget: "Target",
  sizeLink: "Link",
  exactSize: "Exact size",
  sizeUnavailable: "Unavailable",
  modified: "Modified",
  names: "Names",
  natural: "Natural",
  locale: "Locale",
  unicode: "Unicode",
  order: "Order",
  ascending: "Ascending",
  descending: "Descending",
  directoriesFirst: "Folders first",
  appearance: "Appearance",
  system: "System",
  light: "Light",
  dark: "Dark",
  searchArchive: "Search archive",
  archiveSearchInput: "Search archive files",
  entries: "{count} entries",
  pageEntries: "{total} entries · {count} on this page",
  loading: "Loading…",
  noMatches: "No matching entries.",
  empty: "This directory is empty.",
  pagination: "Pagination",
  previous: "Previous",
  next: "Next",
  page: "Page {page} of {pages}",
  keyboardHelp: "Arrow keys select files · Home / End jump · / searches · Backspace opens parent",
  modifiedTime: "Modified time",
  close: "Close",
  unknown: "Unknown",
  unavailable: "Target unavailable",
  beginArchive: "Enter a search to begin.",
  searchingArchive: "Searching archive…",
  archiveResults: "{count} results",
  truncatedResults: "Showing {shown} of {count} results",
  archiveError: "Could not load archive search. Try again.",
  listingError: "Could not load complete directory data. Native page links remain available.",
  folderError: "Could not open the folder. Its native link remains available.",
  updatesError: "Live updates disconnected. Refresh to retry.",
  retry: "Retry",
  openNative: "Open folder directly",
  categories: "File categories",
  items: "{count} items",
  filesIn: "Files in {path}",
  controller: "Controller · Confirm / Back",
  color: "Color",
  pauseMotion: "Pause motion",
  resumeMotion: "Resume motion",
  copyLink: "Copy link",
  copyPath: "Copy path",
  download: "Download",
  copied: "Copied.",
  copyError: "Could not copy. Use the native link or select the path.",
  repository: "Repository",
  author: "by",
  target: "Target",
  newTab: "opens in a new tab",
};
export type ThemeLabels = Readonly<typeof defaultLabels>;
export type ThemeColumn =
  | "name"
  | "size"
  | "modified"
  | { readonly dataKey: string; readonly label: string };
export type ThemeAction = "copy-link" | "copy-path" | "download";
export interface SizeDisplayOptions extends ByteFormatOptions {
  readonly symlink?: "both" | "target" | "entry";
  readonly exact?: "details" | "inline" | "none";
}
export interface ThemeCustomization {
  readonly size?: SizeDisplayOptions;
  readonly language?: string;
  readonly direction?: "ltr" | "rtl";
  readonly locale?: string;
  readonly timeZone?: string;
  readonly labels?: Partial<ThemeLabels>;
  readonly brand?: {
    readonly name?: string;
    readonly logoUrl?: string;
    readonly logoAlt?: string;
    readonly footerText?: string;
    readonly footerUrl?: string;
    readonly faviconUrl?: string;
  };
  readonly columns?: readonly ThemeColumn[];
  readonly actions?: readonly ThemeAction[];
  /** Theme-specific CSS variable names; declarations and markup are rejected. */
  readonly cssVariables?: Readonly<Record<`--${string}`, string>>;
}
export interface ResolvedThemeCustomization {
  readonly size: SizeDisplayOptions;
  readonly language: string;
  readonly dateOptions: { readonly locale?: string; readonly timeZone?: string };
  readonly direction: "ltr" | "rtl";
  readonly locale: string;
  readonly timeZone: string;
  readonly labels: ThemeLabels;
  readonly brand: NonNullable<ThemeCustomization["brand"]>;
  readonly columns: readonly ThemeColumn[];
  readonly actions: readonly ThemeAction[];
  readonly cssVariables: Readonly<Record<string, string>>;
}
export function resolveCustomization(options: ThemeCustomization = {}): ResolvedThemeCustomization {
  const size = options.size === undefined ? {} : options.size;
  if (typeof size !== "object" || size === null || Array.isArray(size))
    throw new TypeError("size must be an object");
  for (const key of Object.keys(size))
    if (!["units", "locale", "maximumFractionDigits", "symlink", "exact"].includes(key))
      throw new TypeError(`Unsupported size option: ${key}`);
  const { symlink, exact, ...byteOptions } = size;
  validateByteFormatOptions(byteOptions);
  if (symlink !== undefined && !["both", "target", "entry"].includes(symlink))
    throw new TypeError("Unsupported symlink size display");
  if (exact !== undefined && !["details", "inline", "none"].includes(exact))
    throw new TypeError("Unsupported exact size display");
  const language = options.language === undefined ? "en" : options.language,
    locale = options.locale === undefined ? "en-US" : options.locale,
    timeZone = options.timeZone === undefined ? "UTC" : options.timeZone;
  for (const [key, value] of Object.entries({ language, locale, timeZone }))
    if (typeof value !== "string" || !value)
      throw new TypeError(`${key} must be a non-empty string`);
  new Intl.DateTimeFormat(locale, { timeZone });
  const direction = options.direction ?? "ltr";
  if (direction !== "ltr" && direction !== "rtl")
    throw new TypeError("direction must be ltr or rtl");
  const labels = { ...defaultLabels };
  if (options.labels !== undefined) {
    if (
      typeof options.labels !== "object" ||
      options.labels === null ||
      Array.isArray(options.labels)
    )
      throw new TypeError("labels must be an object");
    for (const [key, value] of Object.entries(options.labels)) {
      if (!Object.hasOwn(labels, key) || typeof value !== "string")
        throw new TypeError(`Unsupported label or value: ${key}`);
      Object.assign(labels, { [key]: value });
    }
  }
  const brand = options.brand ?? {};
  if (typeof brand !== "object" || brand === null || Array.isArray(brand))
    throw new TypeError("brand must be an object");
  for (const [key, value] of Object.entries(brand)) {
    if (
      !["name", "logoUrl", "logoAlt", "footerText", "footerUrl", "faviconUrl"].includes(key) ||
      typeof value !== "string"
    )
      throw new TypeError(`Unsupported brand option or value: ${key}`);
    if (
      key.endsWith("Url") &&
      !/^https?:\/\//i.test(value) &&
      !(value.startsWith("/") && !value.startsWith("//"))
    )
      throw new TypeError(`brand.${key} must be an HTTP(S) or root-relative URL`);
  }
  const columns = options.columns ?? ["name", "size", "modified"];
  if (!Array.isArray(columns) || !columns.includes("name"))
    throw new TypeError("columns must contain name and unique supported columns");
  const columnIds = new Set<string>();
  for (const column of columns) {
    let id: string;
    if (typeof column === "string") {
      if (!["name", "size", "modified"].includes(column)) throw new TypeError("Unsupported column");
      id = column;
    } else {
      if (
        typeof column !== "object" ||
        column === null ||
        Object.keys(column).some((key) => !["dataKey", "label"].includes(key)) ||
        typeof column.dataKey !== "string" ||
        !column.dataKey ||
        typeof column.label !== "string" ||
        !column.label
      )
        throw new TypeError("Data columns require dataKey and label");
      id = "data:" + column.dataKey;
    }
    if (columnIds.has(id)) throw new TypeError("columns must contain unique supported columns");
    columnIds.add(id);
  }
  const actions = options.actions ?? [];
  if (
    !Array.isArray(actions) ||
    new Set(actions).size !== actions.length ||
    actions.some((key) => !["copy-link", "copy-path", "download"].includes(key))
  )
    throw new TypeError("actions must contain unique supported actions");
  const cssVariables = options.cssVariables ?? {};
  if (typeof cssVariables !== "object" || cssVariables === null || Array.isArray(cssVariables))
    throw new TypeError("cssVariables must be an object");
  for (const [key, value] of Object.entries(cssVariables))
    if (
      !/^--[a-zA-Z][a-zA-Z0-9_-]*$/.test(key) ||
      typeof value !== "string" ||
      /[{};<>]/.test(value)
    )
      throw new TypeError(`Invalid CSS variable: ${key}`);
  return {
    language,
    dateOptions: {
      ...(options.locale === undefined ? {} : { locale: options.locale }),
      ...(options.timeZone === undefined ? {} : { timeZone: options.timeZone }),
    },
    direction,
    locale,
    timeZone,
    labels,
    brand: { ...brand },
    size: { ...size, locale: size.locale ?? options.locale ?? "en-US" },
    columns: columns.map((column) => (typeof column === "string" ? column : { ...column })),
    actions: [...actions],
    cssVariables: { ...cssVariables },
  };
}
export const defaultCustomization = resolveCustomization();
export function label(
  ui: ResolvedThemeCustomization,
  key: keyof ThemeLabels,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return ui.labels[key].replace(/\{([a-zA-Z]+)\}/g, (match, name) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}
const dateFormats = new Map<string, Intl.DateTimeFormat>();
export function formattedDate(
  value: string,
  ui: ResolvedThemeCustomization,
  local = false,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return ui.labels.unknown;
  if (ui.dateOptions.locale === undefined && ui.dateOptions.timeZone === undefined)
    return local
      ? date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
      : date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const locale = ui.dateOptions.locale,
    timeZone = ui.dateOptions.timeZone ?? (local ? undefined : "UTC");
  const key = String(locale) + "\0" + String(timeZone);
  let formatter = dateFormats.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      dateStyle: "short",
      timeStyle: "short",
    });
    if (dateFormats.size >= 32) dateFormats.delete(dateFormats.keys().next().value!);
    dateFormats.set(key, formatter);
  }
  return formatter.format(date);
}
export function customizationCss(ui: ResolvedThemeCustomization): string {
  const declarations = Object.entries(ui.cssVariables)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
  return declarations
    ? `:root:root{${declarations}}${ui.cssVariables["--dw-font-family"] ? "body{font-family:var(--dw-font-family)}" : ""}`
    : "";
}
export async function copyEntryAction(
  action: ThemeAction,
  entry: { id: string; href: string | null },
): Promise<void> {
  const value =
    action === "copy-link" && entry.href ? new URL(entry.href, document.baseURI).href : entry.id;
  if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
  await navigator.clipboard.writeText(value);
}

/** Publish only supplied customization instead of repeating defaults in every page. */
export function pickCustomization(options: ThemeCustomization): ThemeCustomization | undefined {
  const result: ThemeCustomization = {};
  for (const key of [
    "size",
    "language",
    "direction",
    "locale",
    "timeZone",
    "labels",
    "brand",
    "columns",
    "actions",
    "cssVariables",
  ] as const)
    if (options[key] !== undefined) {
      const value = options[key];
      Object.assign(result, {
        [key]: Array.isArray(value)
          ? value.map((item) => (typeof item === "object" ? { ...item } : item))
          : typeof value === "object" && value !== null
            ? { ...value }
            : value,
      });
    }
  return Object.keys(result).length ? result : undefined;
}

/** Built-in factories fail on typos instead of silently ignoring configuration. */
export function assertThemeOptions(value: unknown, extraKeys: readonly string[]): void {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError("Theme options must be an object");
  const allowed = [
    "size",
    "language",
    "direction",
    "locale",
    "timeZone",
    "labels",
    "brand",
    "columns",
    "actions",
    "cssVariables",
    ...extraKeys,
  ];
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) throw new TypeError(`Unsupported theme option: ${key}`);
}

export function columnLabel(column: ThemeColumn, ui: ResolvedThemeCustomization): string {
  return typeof column === "string" ? ui.labels[column] : column.label;
}
export function publicDataValue(value: unknown): string {
  return value === undefined || value === null
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
