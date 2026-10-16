import { loadListing, parseListingEntries, ListingDataError } from "@dirwell/core/client";
import { resolveCustomization } from "./customization.ts";

/** Folder snapshots resolve relative URLs before History changes the document URL. */
export async function fetchThemePage(
  dataHref: string,
  pageHref: string,
  theme: string,
  signal: AbortSignal,
  fresh = false,
  attempt = 0,
): Promise<Record<string, unknown>> {
  const source = new URL(dataHref, document.baseURI);
  if (source.origin !== location.origin)
    throw new ListingDataError("Folder leaves the theme origin");
  const response = await fetch(source, { signal, cache: fresh ? "no-store" : "default" });
  if (!response.ok) throw new ListingDataError("Unavailable folder");
  const value: unknown = await response.json();
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new ListingDataError("Invalid folder snapshot");
  const data = value as Record<string, unknown>;
  if (
    data.version !== 1 ||
    data.theme !== theme ||
    typeof data.title !== "string" ||
    typeof data.path !== "string" ||
    !Number.isSafeInteger(data.total) ||
    Number(data.total) < 0 ||
    !Array.isArray(data.breadcrumbs)
  )
    throw new ListingDataError("Unsupported folder snapshot");
  if (data.metadataHead !== undefined && typeof data.metadataHead !== "string")
    throw new ListingDataError("Invalid folder metadata");
  const sort = data.sort as Record<string, unknown> | null;
  if (
    !sort ||
    typeof sort !== "object" ||
    !["name", "size", "targetSize", "modified"].includes(String(sort.field)) ||
    !["asc", "desc"].includes(String(sort.direction)) ||
    !["natural", "locale", "unicode"].includes(String(sort.nameMode)) ||
    typeof sort.directoriesFirst !== "boolean"
  )
    throw new ListingDataError("Invalid folder order");
  if (theme === "crosswave") {
    const categories = data.categories;
    const ids = new Set<string>();
    if (
      !Array.isArray(categories) ||
      categories.length === 0 ||
      categories.some((category) => {
        if (
          typeof category !== "object" ||
          category === null ||
          typeof category.id !== "string" ||
          !category.id ||
          ids.has(category.id) ||
          typeof category.label !== "string" ||
          typeof category.svg !== "string"
        )
          return true;
        ids.add(category.id);
        return false;
      })
    )
      throw new ListingDataError("Invalid folder categories");
  }
  const base = document.querySelector("base")?.href ?? pageHref;
  const link = (raw: unknown): string | null => {
    if (raw === null) return null;
    if (typeof raw !== "string") throw new ListingDataError("Invalid folder link");
    const url = new URL(raw, base);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== location.origin)
      throw new ListingDataError("Unsupported folder link");
    return url.href;
  };
  const entries = parseListingEntries(data.entries, base).map((entry) => ({
    ...entry,
    ...(entry.presentation
      ? {
          presentation: {
            ...entry.presentation,
            folderDataHref: link(entry.presentation.folderDataHref ?? null),
          },
        }
      : {}),
  }));
  if (entries.length > Number(data.total)) throw new ListingDataError("Invalid folder count");
  if (data.page !== null) {
    const page = data.page as Record<string, unknown> | null;
    if (
      !page ||
      typeof page !== "object" ||
      !Number.isSafeInteger(page.number) ||
      Number(page.number) < 1 ||
      !Number.isSafeInteger(page.count) ||
      Number(page.count) < Number(page.number) ||
      !Number.isSafeInteger(page.offset) ||
      Number(page.offset) < 0 ||
      Number(page.offset) > Number(data.total) ||
      page.total !== data.total
    )
      throw new ListingDataError("Invalid folder pagination");
    data.page = {
      ...page,
      href: link(page.href),
      previousHref: link(page.previousHref),
      nextHref: link(page.nextHref),
    };
  }
  if (data.ui !== undefined)
    resolveCustomization(data.ui as Parameters<typeof resolveCustomization>[0]);
  const result = {
    ...data,
    searchQueryHref: link(data.searchQueryHref ?? null),
    updatesHref: link(data.updatesHref ?? null),
    entries,
    dataHref: source.href,
    manifestHref: link(data.manifestHref),
    rootHref: link(data.rootHref),
    rootDataHref: link(data.rootDataHref),
    parentHref: link(data.parentHref),
    parentDataHref: link(data.parentDataHref),
    breadcrumbs: data.breadcrumbs.map((raw) => {
      if (
        typeof raw !== "object" ||
        raw === null ||
        !("name" in raw) ||
        !("href" in raw) ||
        !("dataHref" in raw) ||
        typeof raw.name !== "string"
      )
        throw new ListingDataError("Invalid breadcrumb");
      return { name: raw.name, href: link(raw.href), dataHref: link(raw.dataHref) };
    }),
  };
  // Keep the current UI until the complete target listing and page revision agree.
  if (result.manifestHref) {
    const loaded = await loadListing(result.manifestHref, {
      signal,
      cache: fresh ? "no-store" : "default",
    });
    if (
      loaded.manifest.total !== data.total ||
      (data.listingRevision !== undefined && loaded.manifest.revision !== data.listingRevision)
    ) {
      if (attempt < 2) return fetchThemePage(dataHref, pageHref, theme, signal, true, attempt + 1);
      throw new ListingDataError("Folder changed while refreshing");
    }
    result.entries = [...loaded.entries];
  }
  return result;
}

// HMR can remount a wrapper while the outer explorer root stays mounted.
// Keep only its current public model; production imports never register roots.
const hotModels = new WeakMap<Element, Record<string, unknown>>();
export function restoreThemePage(
  initial: Record<string, unknown>,
  hot: boolean,
): Record<string, unknown> {
  if (!hot || typeof document === "undefined") return initial;
  const root = document.querySelector("[data-dirwell-theme]");
  if (!root) return initial;
  const snapshot = hotModels.get(root) ?? initial;
  hotModels.set(root, snapshot);
  return snapshot;
}

/** Copy only inert metadata elements; never insert snapshot HTML or event attributes. */
export function applyThemeMetadata(page: Record<string, unknown>, pageHref: string): void {
  const root = document.querySelector("[data-dirwell-theme]");
  if (root && hotModels.has(root)) hotModels.set(root, page);
  document.title = typeof page.title === "string" ? page.title : "";
  const template = document.createElement("template");
  template.innerHTML = typeof page.metadataHead === "string" ? page.metadataHead : "";
  document.head.querySelectorAll("[data-dirwell-metadata]").forEach((element) => element.remove());
  const base = document.querySelector("base")?.href ?? pageHref;
  const url = (value: string): string | null => {
    try {
      const target = new URL(value, base);
      return ["http:", "https:"].includes(target.protocol) ? target.href : null;
    } catch {
      return null;
    }
  };
  for (const element of template.content.children) {
    if (!element.hasAttribute("data-dirwell-metadata")) continue;
    let next: HTMLElement;
    if (element.tagName === "META") {
      const attribute = element.hasAttribute("property") ? "property" : "name";
      const key = element.getAttribute(attribute) ?? "";
      if (!/^(?:description|og:[a-z_:]+|twitter:[a-z_:]+)$/i.test(key)) continue;
      let content = element.getAttribute("content") ?? "";
      if (["og:image", "og:url", "twitter:image"].includes(key)) {
        const resolved = url(content);
        if (resolved === null) continue;
        content = resolved;
      }
      next = document.createElement("meta");
      next.setAttribute(attribute, key);
      next.setAttribute("content", content);
    } else if (
      element.tagName === "LINK" &&
      ["canonical", "icon"].includes(element.getAttribute("rel") ?? "")
    ) {
      const href = url(element.getAttribute("href") ?? "");
      if (href === null) continue;
      next = document.createElement("link");
      next.setAttribute("rel", element.getAttribute("rel")!);
      next.setAttribute("href", href);
      if (element.getAttribute("rel") === "icon")
        for (const attribute of ["type", "sizes", "media"])
          if (element.hasAttribute(attribute))
            next.setAttribute(attribute, element.getAttribute(attribute)!);
    } else continue;
    next.setAttribute("data-dirwell-metadata", "");
    document.head.append(next);
  }
}
