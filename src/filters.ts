import { readdir, readlink } from "node:fs/promises";
import path from "node:path";
import picomatch from "picomatch";

export function normalizePathPatterns(value: unknown, name: string): readonly string[] {
  if (value === undefined) return [];
  const patterns = typeof value === "string" ? [value] : value;
  if (
    !Array.isArray(patterns) ||
    patterns.some(
      (pattern) =>
        typeof pattern !== "string" ||
        pattern.length === 0 ||
        pattern.startsWith("/") ||
        /^[A-Za-z]:/.test(pattern) ||
        pattern.startsWith("!") ||
        pattern.includes("\\") ||
        pattern.split("/").some((segment) => segment === "." || segment === ".."),
    )
  ) {
    throw new TypeError(`${name} must contain root-relative glob patterns using forward slashes`);
  }
  return patterns as readonly string[];
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

export interface SourceSelection {
  readonly selected: ReadonlySet<string>;
  readonly symlinks: ReadonlySet<string>;
  readonly mirroredSymlinks: ReadonlySet<string>;
}

/** Select physical source paths; parent directories remain when a descendant matches. */
export async function selectSourcePaths(
  sourceDir: string,
  outputDir: string,
  include: unknown,
  exclude: unknown,
  ignoredPaths: readonly string[] = [],
): Promise<SourceSelection> {
  const ignored = ignoredPaths.map((value) => path.resolve(value));
  const included = normalizePathPatterns(include, "include").map((pattern) =>
    picomatch(pattern, { dot: true, nonegate: true }),
  );
  const excluded = normalizePathPatterns(exclude, "exclude").map((pattern) =>
    picomatch(pattern, { dot: true, nonegate: true }),
  );
  const selected = new Set<string>([""]);
  const symlinks = new Map<string, string>();

  async function visit(
    directory: string,
    relativeDir: string,
    inheritedInclude: boolean,
  ): Promise<boolean> {
    let hasSelected = false;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (
        isWithin(outputDir, absolutePath) ||
        ignored.some((value) => isWithin(value, absolutePath))
      )
        continue;
      const relativePath = path.posix.join(relativeDir, entry.name);
      const directoryLike = entry.isDirectory();
      const matches = (matcher: (value: string) => boolean) =>
        matcher(relativePath) || (directoryLike && matcher(`${relativePath}/`));
      if (excluded.some(matches)) continue;
      const includedHere = inheritedInclude || included.some(matches);
      if (directoryLike) {
        const hasSelectedChild = await visit(absolutePath, relativePath, includedHere);
        if (included.length === 0 || includedHere || hasSelectedChild) {
          selected.add(relativePath);
          hasSelected = true;
        }
      } else if (included.length === 0 || includedHere) {
        selected.add(relativePath);
        hasSelected = true;
        if (entry.isSymbolicLink()) symlinks.set(relativePath, await readlink(absolutePath));
      }
    }
    return hasSelected;
  }

  await visit(sourceDir, "", false);
  // Absolute, escaping, and filtered targets cannot remain valid inside the copied tree.
  const mirroredSymlinks = new Set<string>();
  for (const [relativePath, target] of symlinks) {
    if (path.isAbsolute(target)) continue;
    const targetPath = path.resolve(sourceDir, path.dirname(relativePath), target);
    if (!isWithin(sourceDir, targetPath)) continue;
    const targetRelativePath = path.relative(sourceDir, targetPath).split(path.sep).join("/");
    if (selected.has(targetRelativePath)) mirroredSymlinks.add(relativePath);
  }
  return { selected, symlinks: new Set(symlinks.keys()), mirroredSymlinks };
}
