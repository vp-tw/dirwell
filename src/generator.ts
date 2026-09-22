import {
  cp,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import type {
  DirectoryData,
  EntryKind,
  ExplorerTheme,
  FileMetadata,
  FileSystemEntry,
  GenerateOptions,
  OutputNameResolver,
  SymlinkMetadata,
} from "./model.ts";
import { defaultTheme } from "./theme-default.ts";

const indexPattern = /^index\.html?$/i;

export const defaultOutputName: OutputNameResolver = ({ entries }) =>
  entries.some((entry) => entry.kind === "file" && indexPattern.test(entry.name))
    ? null
    : "index.html";

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

function isInsideRoot(rootPath: string, candidatePath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function describeEntry({
  absolutePath,
  relativePath,
  rootRealPath,
  ancestors,
  followSymlinks,
}: {
  absolutePath: string;
  relativePath: string;
  rootRealPath: string;
  ancestors: ReadonlySet<string>;
  followSymlinks: boolean;
}): Promise<FileSystemEntry> {
  const linkStats = await lstat(absolutePath);
  const kind = entryKind(linkStats);
  let symlink: SymlinkMetadata | null = null;

  if (kind === "symlink") {
    const target = await readlink(absolutePath);
    let resolvedPath: string | null = null;
    let targetKind: Exclude<EntryKind, "symlink"> | null = null;
    try {
      resolvedPath = await realpath(absolutePath);
      targetKind = entryKind(await stat(absolutePath)) as Exclude<EntryKind, "symlink">;
    } catch {
      // Broken and inaccessible links are represented as data.
    }
    const isOutsideRoot = resolvedPath === null || !isInsideRoot(rootRealPath, resolvedPath);
    const isCycle = resolvedPath !== null && ancestors.has(resolvedPath);
    symlink = {
      target,
      resolvedPath,
      targetRelativePath:
        resolvedPath !== null && !isOutsideRoot
          ? path.relative(rootRealPath, resolvedPath).split(path.sep).join("/")
          : null,
      targetKind,
      isBroken: resolvedPath === null,
      isCycle,
      isOutsideRoot,
      wasFollowed: followSymlinks && targetKind === "directory" && !isCycle && !isOutsideRoot,
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

function assertSafeOutputName(name: string): void {
  if (name.length === 0 || path.basename(name) !== name || name === "." || name === "..") {
    throw new Error(`Output name must be a single safe filename: ${name}`);
  }
}

export async function generateExplorer(options: GenerateOptions): Promise<void> {
  const sourceDir = path.resolve(options.sourceDir);
  const outputDir = path.resolve(options.outputDir);
  const rootRealPath = await realpath(sourceDir);
  const outputName = options.outputName ?? defaultOutputName;
  const theme: ExplorerTheme = options.theme ?? defaultTheme;
  const mode = options.mode ?? "ssg";
  const followSymlinks = options.symlinks?.follow ?? false;
  const boundary = options.symlinks?.boundary ?? "root";
  const onCycle = options.symlinks?.onCycle ?? "skip";
  const plans: Array<{
    readonly directory: DirectoryData;
    readonly logicalDir: string;
    readonly outputName: string | null;
  }> = [];
  if (sourceDir === outputDir) {
    throw new Error("outputDir must not be the sourceDir");
  }
  if (mode === "mpa") {
    try {
      await lstat(path.join(sourceDir, "__dirwell"));
      throw new Error('MPA mode reserves the source-root path "__dirwell"');
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        // The reserved asset path is available.
      } else {
        throw error;
      }
    }
  }
  const outputIsWithinSource = isInsideRoot(sourceDir, outputDir);
  const stageParent = outputIsWithinSource ? path.dirname(sourceDir) : path.dirname(outputDir);
  await mkdir(stageParent, { recursive: true });
  const stagedOutputDir = await mkdtemp(
    path.join(stageParent, `.${path.basename(outputDir)}-dirwell-`),
  );
  const buildOutputDir = stagedOutputDir;

  try {
    if (options.mirror ?? true) {
      await rm(buildOutputDir, { recursive: true, force: true });
      await mkdir(buildOutputDir, { recursive: true });
      await cp(sourceDir, buildOutputDir, {
        recursive: true,
        dereference: false,
        preserveTimestamps: true,
        filter: (sourcePath) => !isInsideRoot(outputDir, path.resolve(sourcePath)),
      });
    }
  } catch (error) {
    await rm(stagedOutputDir, { recursive: true, force: true });
    throw error;
  }

  async function visit(
    logicalDir: string,
    physicalDir: string,
    ancestors: ReadonlySet<string>,
  ): Promise<void> {
    const physicalRealPath = await realpath(physicalDir);
    if (ancestors.has(physicalRealPath)) {
      if (onCycle === "error") throw new Error(`Symlink cycle at ${logicalDir}`);
      return;
    }

    const nextAncestors = new Set(ancestors).add(physicalRealPath);
    const names = (await readdir(physicalDir)).filter(
      (name) => !outputIsWithinSource || !isInsideRoot(outputDir, path.join(physicalDir, name)),
    );
    const entries = await Promise.all(
      names.map((name) =>
        describeEntry({
          absolutePath: path.join(physicalDir, name),
          relativePath: path.posix.join(logicalDir, name),
          rootRealPath,
          ancestors: nextAncestors,
          followSymlinks,
        }),
      ),
    );
    entries.sort((left, right) => {
      const leftDirectory = left.kind === "directory" || left.symlink?.targetKind === "directory";
      const rightDirectory =
        right.kind === "directory" || right.symlink?.targetKind === "directory";
      if (leftDirectory !== rightDirectory) return leftDirectory ? -1 : 1;
      return left.name.localeCompare(right.name, "en", { numeric: true });
    });

    const describedCurrent = await describeEntry({
      absolutePath: physicalDir,
      relativePath: logicalDir,
      rootRealPath,
      ancestors,
      followSymlinks,
    });
    if (describedCurrent.kind !== "directory") {
      throw new Error(`${physicalDir} is not a directory`);
    }
    const current: DirectoryData["current"] = {
      ...describedCurrent,
      kind: "directory",
    };

    const root = await describeEntry({
      absolutePath: sourceDir,
      relativePath: "",
      rootRealPath,
      ancestors: new Set(),
      followSymlinks,
    });
    const parent =
      logicalDir === ""
        ? null
        : await describeEntry({
            absolutePath: path.dirname(physicalDir),
            relativePath:
              path.posix.dirname(logicalDir) === "." ? "" : path.posix.dirname(logicalDir),
            rootRealPath,
            ancestors,
            followSymlinks,
          });
    const directory: DirectoryData = {
      root,
      current,
      parent,
      depth: logicalDir === "" ? 0 : logicalDir.split("/").length,
      entries,
    };

    const name = await outputName(directory);
    if (name !== null) assertSafeOutputName(name);
    plans.push({ directory, logicalDir, outputName: name });

    for (const entry of entries) {
      if (entry.kind === "directory") {
        await visit(path.posix.join(logicalDir, entry.name), entry.absolutePath, nextAncestors);
        continue;
      }
      if (!followSymlinks || entry.symlink?.targetKind !== "directory") continue;
      if (entry.symlink.isCycle) {
        if (onCycle === "error") throw new Error(`Symlink cycle at ${entry.relativePath}`);
        continue;
      }
      if (entry.symlink.resolvedPath === null) continue;
      if (boundary === "root" && entry.symlink.isOutsideRoot) continue;
      await visit(
        path.posix.join(logicalDir, entry.name),
        entry.symlink.resolvedPath,
        nextAncestors,
      );
    }
  }

  try {
    await visit("", sourceDir, new Set());

    const generatedDirectories = new Set(
      plans.filter((plan) => plan.outputName !== null).map((plan) => plan.logicalDir),
    );
    const sharedAssets = new Map<string, string | Uint8Array>();

    for (const plan of plans) {
      const { directory, logicalDir, outputName: name } = plan;
      if (name === null) continue;

      const targetLogicalPathFor = (entry: FileSystemEntry): string | null => {
        if (entry.symlink?.isBroken || entry.symlink?.isOutsideRoot) return null;
        if (entry.symlink?.targetRelativePath !== null && entry.symlink !== null) {
          return entry.symlink.targetRelativePath;
        }
        return path.posix.join(logicalDir, entry.name);
      };
      const hrefFor = (entry: FileSystemEntry): string | null => {
        const targetLogicalPath = targetLogicalPathFor(entry);
        if (targetLogicalPath === null) return null;
        const relativeTarget = path.posix.relative(
          logicalDir === "" ? "." : logicalDir,
          targetLogicalPath === "" ? "." : targetLogicalPath,
        );
        const encodedTarget = relativeTarget
          .split("/")
          .map((segment) =>
            segment === "." || segment === ".." ? segment : encodeURIComponent(segment),
          )
          .join("/");
        const directoryLike =
          entry.kind === "directory" || entry.symlink?.targetKind === "directory";
        return `${encodedTarget || "."}${directoryLike ? "/" : ""}`;
      };
      const page = await theme.render({
        directory,
        outputName: name,
        mode,
        assetHref: (assetName) => {
          assertSafeOutputName(assetName);
          if (mode === "ssg") return encodeURIComponent(assetName);
          const relativeAsset = path.posix.relative(
            logicalDir === "" ? "." : logicalDir,
            path.posix.join("__dirwell", assetName),
          );
          return relativeAsset
            .split("/")
            .map((segment) =>
              segment === "." || segment === ".." ? segment : encodeURIComponent(segment),
            )
            .join("/");
        },
        hrefFor,
        exitsExplorerFor: (entry) => {
          const targetLogicalPath = targetLogicalPathFor(entry);
          const directoryLike =
            entry.kind === "directory" || entry.symlink?.targetKind === "directory";
          return (
            targetLogicalPath !== null &&
            (!directoryLike || !generatedDirectories.has(targetLogicalPath))
          );
        },
      });
      const targetDir = path.join(buildOutputDir, logicalDir);
      await mkdir(targetDir, { recursive: true });
      await writeFile(path.join(targetDir, name), page.html);
      for (const [assetName, contents] of Object.entries(page.assets ?? {})) {
        assertSafeOutputName(assetName);
        if (mode === "ssg") {
          await writeFile(path.join(targetDir, assetName), contents);
        } else {
          const existing = sharedAssets.get(assetName);
          if (existing !== undefined && existing.toString() !== contents.toString()) {
            throw new Error(`Theme emitted conflicting shared asset: ${assetName}`);
          }
          sharedAssets.set(assetName, contents);
        }
      }
    }

    if (mode === "mpa" && sharedAssets.size > 0) {
      const assetDirectory = path.join(buildOutputDir, "__dirwell");
      await mkdir(assetDirectory, { recursive: true });
      for (const [assetName, contents] of sharedAssets) {
        await writeFile(path.join(assetDirectory, assetName), contents);
      }
    }

    await rm(outputDir, { recursive: true, force: true });
    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(stagedOutputDir, outputDir);
  } finally {
    await rm(stagedOutputDir, { recursive: true, force: true });
  }
}

export async function readGeneratedPage(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}
