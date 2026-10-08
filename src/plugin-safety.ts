import { readdir, readlink, realpath } from "node:fs/promises";
import path from "node:path";
import { selectSourcePaths } from "./filters.ts";
import type { GenerateOptions } from "./model.ts";

export function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

export async function canonicalPath(candidate: string): Promise<string> {
  const missing: string[] = [];
  let existing = candidate;
  while (true) {
    try {
      return path.join(await realpath(existing), ...missing.reverse());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(existing);
      if (parent === existing) throw error;
      missing.push(path.basename(existing));
      existing = parent;
    }
  }
}

export async function assertSafeMirroredSymlinks(options: GenerateOptions): Promise<void> {
  const sourceDir = path.resolve(options.sourceDir);
  const outputDir = path.resolve(options.outputDir);
  const selection = await selectSourcePaths(sourceDir, outputDir, options.include, options.exclude);
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (isWithin(outputDir, entryPath)) continue;
      const relativePath = path.relative(sourceDir, entryPath).split(path.sep).join("/");
      if (!selection.selected.has(relativePath)) continue;
      if (entry.isSymbolicLink()) {
        const target = await readlink(entryPath);
        if (path.isAbsolute(target) || !isWithin(sourceDir, path.resolve(directory, target))) {
          throw new Error(`Dirwell cannot mirror a symlink outside its output: ${entryPath}`);
        }
      } else if (entry.isDirectory()) {
        await visit(entryPath);
      }
    }
  }
  await visit(sourceDir);
}
