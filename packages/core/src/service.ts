import { validateDirectoryOptions } from "./validation.ts";
import { readdir, realpath, open, type FileHandle } from "node:fs/promises";
import { constants } from "node:fs";
import { fileIdentityMatches } from "./file-identity.ts";
import path from "node:path";
import { describeEntry, isInsideRoot } from "./filesystem.ts";
import {
  selectSourcePaths,
  resolveIgnoreFiles,
  createIgnoreMatcher,
  normalizePathPatterns,
} from "./filters.ts";
import { compareEntries } from "./generator.ts";
import { entryDataFacts } from "./listing.ts";
import { copyJsonObject } from "./json.ts";
import type {
  DirectoryData,
  FileSystemEntry,
  SortOptions,
  IgnoreFile,
  EntryDataProvider,
} from "./model.ts";

export interface DirectoryServiceOptions {
  readonly entryData?: EntryDataProvider;
  readonly root: string;
  readonly include?: string | readonly string[];
  readonly exclude?: string | readonly string[];
  readonly ignoreFiles?: readonly IgnoreFile[];
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
  validateDirectoryOptions(options);
  const root = await realpath(options.root);
  const ignoreFiles = resolveIgnoreFiles(options.ignoreFiles);
  // Validate explicit sources before an HTTP host starts accepting requests.
  await createIgnoreMatcher(ignoreFiles);
  normalizePathPatterns(options.include, "include");
  normalizePathPatterns(options.exclude, "exclude");
  const selected = async () => {
    const matcher = await createIgnoreMatcher(ignoreFiles);
    if (
      normalizePathPatterns(options.include, "include").length === 0 &&
      normalizePathPatterns(options.exclude, "exclude").length === 0 &&
      !matcher.hasRules
    )
      return null;
    return (
      await selectSourcePaths(
        root,
        path.join(root, "__dirwell"),
        options.include,
        options.exclude,
        [],
        ignoreFiles,
        matcher,
      )
    ).selected;
  };
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
      const described = await Promise.all(
        names
          .filter((name) => selection === null || selection.has(path.posix.join(logicalPath, name)))
          .map(async (name) => {
            let entry: FileSystemEntry;
            try {
              entry = await describe(path.posix.join(logicalPath, name), selection);
            } catch (error) {
              // An enumerated child may disappear before stat; the directory is still available.
              if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
              throw error;
            }
            return options.entryData === undefined
              ? entry
              : {
                  ...entry,
                  publicData: copyJsonObject(
                    await options.entryData(entryDataFacts(entry), {
                      operation: "server",
                      directoryPath: logicalPath,
                    }),
                  ),
                };
          }),
      );
      const entries = described.filter((entry): entry is FileSystemEntry => entry !== null);
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
