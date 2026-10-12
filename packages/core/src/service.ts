import { readdir, realpath, open, type FileHandle } from "node:fs/promises";
import { constants } from "node:fs";
import { fileIdentityMatches } from "./file-identity.ts";
import path from "node:path";
import { describeEntry, isInsideRoot } from "./filesystem.ts";
import { selectSourcePaths } from "./filters.ts";
import { compareEntries } from "./generator.ts";
import type { DirectoryData, FileSystemEntry, SortOptions } from "./model.ts";

export interface DirectoryServiceOptions {
  readonly root: string;
  readonly include?: string | readonly string[];
  readonly exclude?: string | readonly string[];
  readonly sort?: SortOptions;
}
export interface DirectoryService {
  readonly resolvePath: (logicalPath: string) => Promise<string>;
  readonly openFile: (logicalPath: string) => Promise<{
    readonly entry: FileSystemEntry;
    readonly handle: FileHandle;
    readonly canonicalPath: string;
  }>;
  readonly getEntry: (logicalPath: string) => Promise<FileSystemEntry>;
  readonly listDirectory: (logicalPath: string) => Promise<DirectoryData>;
}
export class DirectoryAccessError extends Error {
  override readonly name = "DirectoryAccessError";
}
function assertLogicalPath(value: string): void {
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value
      .split("/")
      .some((segment) => segment === "." || segment === ".." || (segment === "" && value !== "")) ||
    /^[a-z]:/i.test(value) ||
    value === "__dirwell" ||
    value.startsWith("__dirwell/")
  )
    throw new DirectoryAccessError("Unavailable path");
}
/** Live reads; no watcher, recursive stat snapshot, output tree or implicit cache. */
export async function createDirectoryService(
  options: DirectoryServiceOptions,
): Promise<DirectoryService> {
  const root = await realpath(options.root);
  const selected = async () =>
    options.include === undefined && options.exclude === undefined
      ? null
      : (
          await selectSourcePaths(
            root,
            path.join(root, "__dirwell"),
            options.include,
            options.exclude,
          )
        ).selected;
  async function describe(
    logicalPath: string,
    selection: ReadonlySet<string> | null,
  ): Promise<FileSystemEntry> {
    assertLogicalPath(logicalPath);
    if (selection !== null && !selection.has(logicalPath))
      throw new DirectoryAccessError("Unavailable path");
    const absolutePath = path.join(root, logicalPath);
    const parent = logicalPath === "" ? root : await realpath(path.dirname(absolutePath));
    if (!isInsideRoot(root, parent)) throw new DirectoryAccessError("Unavailable path");
    const ancestors = new Set<string>([root]);
    if (logicalPath !== "") {
      const segments = logicalPath.split("/").slice(0, -1);
      for (let length = 1; length <= segments.length; length++)
        ancestors.add(await realpath(path.join(root, ...segments.slice(0, length))));
    }
    return describeEntry({
      absolutePath,
      relativePath: logicalPath,
      rootRealPath: root,
      ancestors,
      followSymlinks: false,
      selectedPaths: selection,
    });
  }
  return {
    async resolvePath(logicalPath) {
      const selection = await selected();
      const entry = await describe(logicalPath, selection);
      if (
        entry.symlink &&
        (entry.symlink.isBroken || entry.symlink.isOutsideRoot || entry.symlink.isTargetExcluded)
      )
        throw new DirectoryAccessError("Unavailable target");
      const resolved = await realpath(entry.absolutePath);
      if (!isInsideRoot(root, resolved)) throw new DirectoryAccessError("Unavailable target");
      const canonical = path.relative(root, resolved).split(path.sep).join("/");
      if (selection !== null && !selection.has(canonical))
        throw new DirectoryAccessError("Unavailable target");
      return canonical;
    },
    async openFile(logicalPath) {
      assertLogicalPath(logicalPath);
      const selection = await selected();
      let entry = await describe(logicalPath, selection);
      if (entry.symlink !== null) {
        if (
          entry.symlink.isBroken ||
          entry.symlink.isOutsideRoot ||
          entry.symlink.isTargetExcluded ||
          entry.symlink.targetRelativePath === null
        )
          throw new DirectoryAccessError("Unavailable file");
        entry = await describe(entry.symlink.targetRelativePath, selection);
      }
      if (entry.kind !== "file") throw new DirectoryAccessError("Unavailable file");
      const handle = await open(
        entry.absolutePath,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
      try {
        const stats = await handle.stat();
        const resolved = await realpath(entry.absolutePath);
        if (
          !stats.isFile() ||
          !isInsideRoot(root, resolved) ||
          !fileIdentityMatches(entry.metadata, stats)
        )
          throw new DirectoryAccessError("File changed before opening");
        return {
          entry,
          handle,
          canonicalPath: path.relative(root, resolved).split(path.sep).join("/"),
        };
      } catch (error) {
        await handle.close();
        throw error;
      }
    },
    async getEntry(logicalPath) {
      assertLogicalPath(logicalPath);
      return describe(logicalPath, await selected());
    },
    async listDirectory(logicalPath) {
      assertLogicalPath(logicalPath);
      const selection = await selected();
      const entry = await describe(logicalPath, selection);
      if (entry.kind !== "directory") throw new DirectoryAccessError("Unavailable directory");
      const physical = await realpath(entry.absolutePath);
      if (!isInsideRoot(root, physical)) throw new DirectoryAccessError("Unavailable directory");
      const names = (await readdir(physical)).filter(
        (name) => logicalPath !== "" || name !== "__dirwell",
      );
      const entries = await Promise.all(
        names
          .filter((name) => selection === null || selection.has(path.posix.join(logicalPath, name)))
          .map((name) => describe(path.posix.join(logicalPath, name), selection)),
      );
      entries.sort(
        (left, right) =>
          compareEntries(left, right, options.sort) ||
          (left.relativePath < right.relativePath
            ? -1
            : left.relativePath > right.relativePath
              ? 1
              : 0),
      );
      return {
        root: await describe("", selection),
        current: { ...entry, kind: "directory" },
        parent:
          logicalPath === ""
            ? null
            : await describe(
                path.posix.dirname(logicalPath) === "." ? "" : path.posix.dirname(logicalPath),
                selection,
              ),
        depth: logicalPath === "" ? 0 : logicalPath.split("/").length,
        entries,
      };
    },
  };
}
