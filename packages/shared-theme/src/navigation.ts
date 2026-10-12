import { parseListingEntries, ListingDataError } from "@dirwell/core/client";

/** Folder snapshots resolve relative URLs before History changes the document URL. */
export async function fetchThemePage(
  dataHref: string,
  pageHref: string,
  theme: string,
  signal: AbortSignal,
  fresh = false,
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
  return {
    ...data,
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
}
