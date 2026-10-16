import { sizeValue } from "../../core/src/format.ts";
import type { ListingEntry, SortOptions } from "@dirwell/core";
export const directoryLike = (entry: ListingEntry) =>
  entry.kind === "directory" || entry.link?.targetKind === "directory";
export const entryType = (entry: ListingEntry) =>
  entry.kind === "symlink" ? "link" : directoryLike(entry) ? "directory" : "file";
export function fuzzy(query: string, value: string): number | null {
  let score = 0,
    start = 0,
    last = -2;
  for (const character of query.trim().toLocaleLowerCase()) {
    const index = value.toLocaleLowerCase().indexOf(character, start);
    if (index < 0) return null;
    if (index === last + 1) score += 8;
    if (index === 0 || /[\s/_.-]/.test(value[index - 1] ?? "")) score += 5;
    score += Math.max(0, 4 - index * 0.05);
    last = index;
    start = index + 1;
  }
  return score - value.length * 0.01;
}
export function visibleRecords(
  entries: readonly ListingEntry[],
  query: string,
  types: readonly string[],
  sort: Required<SortOptions>,
): ListingEntry[] {
  return entries
    .map((entry) => ({ entry, score: fuzzy(query, `${entry.name} ${entry.link?.target ?? ""}`) }))
    .filter((item) => types.includes(entryType(item.entry)) && item.score !== null)
    .sort((left, right) => {
      if (query.trim() && left.score !== right.score) return (right.score ?? 0) - (left.score ?? 0);
      const a = left.entry,
        b = right.entry;
      if (sort.directoriesFirst && directoryLike(a) !== directoryLike(b))
        return directoryLike(a) ? -1 : 1;
      const sizeBasis = sort.field === "targetSize" ? "target" : "entry";
      const aSize = sizeValue(a, sizeBasis),
        bSize = sizeValue(b, sizeBasis);
      if (
        (sort.field === "size" || sort.field === "targetSize") &&
        (aSize === null) !== (bSize === null)
      )
        return aSize === null ? 1 : -1;
      const name = () =>
        sort.nameMode === "unicode"
          ? compareUnicode(a.name, b.name)
          : a.name.localeCompare(b.name, undefined, {
              numeric: sort.nameMode === "natural",
              sensitivity: "base",
            });
      const primary =
        (sort.field === "name"
          ? name()
          : sort.field === "size" || sort.field === "targetSize"
            ? (aSize ?? 0) - (bSize ?? 0)
            : a.modifiedAt.localeCompare(b.modifiedAt)) || name();
      return (sort.direction === "asc" ? primary : -primary) || compareUnicode(a.id, b.id);
    })
    .map((item) => item.entry);
}
function compareUnicode(left: string, right: string): number {
  const a = [...left],
    b = [...right];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const delta = (a[i]?.codePointAt(0) ?? 0) - (b[i]?.codePointAt(0) ?? 0);
    if (delta) return delta;
  }
  return a.length - b.length;
}
export function modified(value: string, local = false): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return local
    ? date.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
