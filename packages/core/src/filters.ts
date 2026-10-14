import { readdir, readlink, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import picomatch from "picomatch";
import ignore from "ignore";
import type { IgnoreFile } from "./model.ts";

/** Resolve configuration paths once, before a host changes working directories. */
export function resolveIgnoreFiles(
  value: unknown = [],
  cwd = process.cwd(),
): readonly Exclude<IgnoreFile, string>[] {
  if (!Array.isArray(value)) throw new TypeError("ignoreFiles must be an array");
  return value.map((input) => {
    const file = typeof input === "string" ? { path: input } : input;
    if (typeof file !== "object" || file === null || Array.isArray(file))
      throw new TypeError("ignoreFiles entries must be paths or objects");
    for (const key of Object.keys(file))
      if (!["path", "baseDir", "optional"].includes(key))
        throw new TypeError(`Unsupported ignoreFiles key "${key}"`);
    for (const key of ["path", "baseDir"] as const)
      if (
        (key === "path" || file[key] !== undefined) &&
        (typeof file[key] !== "string" || file[key].length === 0)
      )
        throw new TypeError(`ignoreFiles.${key} must be a non-empty string`);
    if (file.optional !== undefined && typeof file.optional !== "boolean")
      throw new TypeError("ignoreFiles.optional must be a boolean");
    const filename = path.resolve(cwd, file.path);
    return {
      path: filename,
      baseDir: path.resolve(cwd, file.baseDir ?? path.dirname(filename)),
      optional: file.optional ?? false,
    };
  });
}

export async function createIgnoreMatcher(files: readonly IgnoreFile[]) {
  const rules: { base: string; matcher: ReturnType<typeof ignore> }[] = [];
  for (const file of resolveIgnoreFiles(files)) {
    let contents: string;
    try {
      contents = await readFile(file.path, "utf8");
    } catch (error) {
      if (file.optional && error instanceof Error && "code" in error && error.code === "ENOENT")
        continue;
      throw error;
    }
    rules.push({ base: await realpath(file.baseDir!), matcher: ignore().add(contents) });
  }
  return (filename: string, directory: boolean): boolean => {
    let ignored = false;
    for (const rule of rules) {
      if (!isWithin(rule.base, filename)) continue;
      const relative = path.relative(rule.base, filename).split(path.sep).join("/");
      if (relative === "") continue;
      const result = rule.matcher.test(relative + (directory ? "/" : ""));
      if (result.ignored) ignored = true;
      else if (result.unignored) ignored = false;
    }
    return ignored;
  };
}

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
  ignoreFiles: readonly IgnoreFile[] = [],
): Promise<SourceSelection> {
  const isIgnored = await createIgnoreMatcher(ignoreFiles);
  const canonicalRoot = await realpath(sourceDir);
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
      if (
        excluded.some(matches) ||
        isIgnored(path.join(canonicalRoot, relativePath), directoryLike)
      )
        continue;
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

  if (!isIgnored(canonicalRoot, true)) await visit(sourceDir, "", false);
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
