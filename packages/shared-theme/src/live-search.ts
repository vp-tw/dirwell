export async function queryLiveArchive(href: string, query: string, signal: AbortSignal) {
  const url = new URL(href, document.baseURI);
  if (url.origin !== location.origin) throw new Error("Unsafe search endpoint");
  url.searchParams.set("q", query);
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Archive search unavailable");
  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("version" in data) ||
    data.version !== 1 ||
    !("results" in data) ||
    !Array.isArray(data.results) ||
    data.results.length > 10000 ||
    !("truncated" in data) ||
    typeof data.truncated !== "boolean"
  )
    throw new Error("Invalid archive results");
  const records = data.results.map((entry: unknown) => {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("name" in entry) ||
      typeof entry.name !== "string" ||
      !("path" in entry) ||
      typeof entry.path !== "string" ||
      !("kind" in entry) ||
      !["file", "directory"].includes(String(entry.kind)) ||
      !("href" in entry) ||
      (entry.href !== null && typeof entry.href !== "string")
    )
      throw new Error("Invalid archive record");
    const target = entry.href === null ? null : new URL(entry.href, url);
    if (target && !["http:", "https:"].includes(target.protocol))
      throw new Error("Unsafe archive link");
    return {
      name: entry.name,
      path: entry.path,
      href: target?.href ?? null,
      exitsExplorer: entry.kind !== "directory",
    };
  });
  return { records, truncated: data.truncated };
}
