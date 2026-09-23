export function fuzzyScore(query: string, value: string): number | null;
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
