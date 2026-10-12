import { lstat, readlink, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { Stats } from "node:fs";
import type { EntryKind, FileMetadata, FileSystemEntry, SymlinkMetadata } from "./model.ts";
function entryKind(stats: Stats): EntryKind {
  if (stats.isDirectory()) return "directory";
  if (stats.isFile()) return "file";
  if (stats.isSymbolicLink()) return "symlink";
  return "other";
}

function metadata(stats: Stats): FileMetadata {
  return {
    device: stats.dev,
    groupId: stats.gid,
    hardLinkCount: stats.nlink,
    inode: stats.ino,
    mode: stats.mode,
    ownerId: stats.uid,
    size: stats.size,
    times: {
      accessedAt: stats.atime.toISOString(),
      changedAt: stats.ctime.toISOString(),
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
    },
  };
}

export function isInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

export async function describeEntry({
  absolutePath,
  relativePath,
  rootRealPath,
  ancestors,
  followSymlinks,
  selectedPaths,
}: {
  absolutePath: string;
  relativePath: string;
  rootRealPath: string;
  ancestors: ReadonlySet<string>;
  followSymlinks: boolean;
  selectedPaths: ReadonlySet<string> | null;
}): Promise<FileSystemEntry> {
  const linkStats = await lstat(absolutePath);
  const kind = entryKind(linkStats);
  let symlink: SymlinkMetadata | null = null;

  if (kind === "symlink") {
    const target = await readlink(absolutePath);
    let resolvedPath: string | null = null;
    let targetKind: Exclude<EntryKind, "symlink"> | null = null;
    let targetSize: number | null = null;
    try {
      resolvedPath = await realpath(absolutePath);
      const targetStats = await stat(absolutePath);
      targetKind = entryKind(targetStats) as Exclude<EntryKind, "symlink">;
      targetSize = targetStats.size;
    } catch {
      // Broken and inaccessible links are represented as data.
    }
    const isOutsideRoot = resolvedPath === null || !isInsideRoot(rootRealPath, resolvedPath);
    const isCycle = resolvedPath !== null && ancestors.has(resolvedPath);
    const targetRelativePath =
      resolvedPath !== null && !isOutsideRoot
        ? path.relative(rootRealPath, resolvedPath).split(path.sep).join("/")
        : null;
    const isTargetExcluded =
      targetRelativePath !== null &&
      selectedPaths !== null &&
      !selectedPaths.has(targetRelativePath);
    symlink = {
      target,
      resolvedPath,
      targetRelativePath,
      targetKind,
      targetSize:
        isOutsideRoot || isTargetExcluded || targetKind === "directory" ? null : targetSize,
      isBroken: resolvedPath === null,
      isCycle,
      isOutsideRoot,
      isTargetExcluded,
      wasFollowed:
        followSymlinks &&
        targetKind === "directory" &&
        !isCycle &&
        !isOutsideRoot &&
        !isTargetExcluded,
    };
  }

  return {
    name: path.basename(absolutePath),
    absolutePath,
    relativePath,
    kind,
    metadata: metadata(linkStats),
    symlink,
  };
}
