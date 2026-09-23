export function fuzzyScore(query: string, value: string): number | null;
export function entryType(entry: {
  readonly kind?: string;
  readonly targetKind?: string | null;
  readonly link?: boolean;
  readonly isLink?: boolean;
  readonly dataset?: { readonly kind?: string; readonly link?: string };
}): "directory" | "file" | "link";
export class HeightTree {
  constructor(length: number, estimate?: number);
  readonly length: number;
  readonly estimate: number;
  update(index: number, height: number): number;
  prefix(count: number): number;
  indexAt(offset: number): number;
}
export function compareEntryValues(
  left: Readonly<{ directory: boolean; modified: number; name: string; size: number }>,
  right: Readonly<{ directory: boolean; modified: number; name: string; size: number }>,
  sort: Readonly<{
    direction: "asc" | "desc";
    directoriesFirst: boolean;
    field: "modified" | "name" | "size";
    nameMode: "locale" | "natural" | "unicode";
  }>,
): number;
