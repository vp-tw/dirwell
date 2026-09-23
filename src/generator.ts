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
import { createHash } from "node:crypto";
import path from "node:path";
import type {
  DirectoryData,
  EntryKind,
  ExplorerTheme,
  FileMetadata,
  FileSystemEntry,
  GenerateOptions,
  NameSortMode,
  OutputNameResolver,
  SortOptions,
  SymlinkMetadata,
} from "./model.ts";
import { defaultTheme } from "./theme-default.ts";

const indexPattern = /^index\.html?$/i;

const defaultSort = {
  direction: "asc",
  directoriesFirst: true,
  field: "name",
  nameMode: "natural",
} as const satisfies Required<SortOptions>;

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

function normalizeBase(value: string): string {
  if (value.includes("?") || value.includes("#")) {
    throw new TypeError("base must not contain a query string or fragment");
  }
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
    return url.href;
  }
  if (!value.startsWith("/")) {
    throw new TypeError('base must start with "/" or be an absolute HTTP(S) URL');
  }
  return `${value.replace(/\/+$/, "")}/`;
}

function encodeLogicalPath(value: string): string {
  return value
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function isDirectoryLike(entry: FileSystemEntry): boolean {
  return entry.kind === "directory" || entry.symlink?.targetKind === "directory";
}

function compareUnicode(left: string, right: string): number {
  const leftPoints = [...left];
  const rightPoints = [...right];
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference =
      (leftPoints[index]?.codePointAt(0) ?? 0) - (rightPoints[index]?.codePointAt(0) ?? 0);
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

function compareNames(left: string, right: string, mode: NameSortMode): number {
  if (mode === "unicode") return compareUnicode(left, right);
  return left.localeCompare(right, undefined, {
    numeric: mode === "natural",
    sensitivity: "base",
  });
}

export function compareEntries(
  left: FileSystemEntry,
  right: FileSystemEntry,
  options: SortOptions = {},
): number {
  const resolved = { ...defaultSort, ...options };
  if (resolved.directoriesFirst && isDirectoryLike(left) !== isDirectoryLike(right)) {
    return isDirectoryLike(left) ? -1 : 1;
  }
  let result: number;
  if (resolved.field === "modified") {
    result = left.metadata.times.modifiedAt.localeCompare(right.metadata.times.modifiedAt);
  } else if (resolved.field === "size") {
    result =
      (isDirectoryLike(left) ? 0 : left.metadata.size) -
      (isDirectoryLike(right) ? 0 : right.metadata.size);
  } else {
    result = compareNames(left.name, right.name, resolved.nameMode);
  }
  if (result === 0) result = compareNames(left.name, right.name, resolved.nameMode);
  return resolved.direction === "asc" ? result : -result;
}

function rawLinkFilename(entry: FileSystemEntry): string {
  return `${createHash("sha256")
    .update(entry.relativePath)
    .update("\0")
    .update(entry.symlink?.target ?? "")
    .digest("hex")
    .slice(0, 16)}.txt`;
}

export async function generateExplorer(options: GenerateOptions): Promise<void> {
  const sourceDir = path.resolve(options.sourceDir);
  const outputDir = path.resolve(options.outputDir);
  const rootRealPath = await realpath(sourceDir);
  const outputName = options.outputName ?? defaultOutputName;
  const resolveOutputName: OutputNameResolver =
    typeof outputName === "string" ? () => outputName : outputName;
  const theme: ExplorerTheme = options.theme ?? defaultTheme;
  const mode = options.mode ?? "ssg";
  const urlStrategy = options.urlStrategy ?? "relative";
  const base = normalizeBase(options.base ?? "/");
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
  try {
    await lstat(path.join(sourceDir, "__dirwell"));
    throw new Error('Dirwell reserves the source-root path "__dirwell"');
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      // The reserved asset path is available.
    } else {
      throw error;
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
    entries.sort((left, right) => compareEntries(left, right, options.sort));

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

    const name = await resolveOutputName(directory);
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
    const rawLinkFiles = new Map<string, string>();
    const searchEntries = new Map<
      string,
      {
        href: string | null;
        exitsExplorer: boolean;
        isLink: boolean;
        kind: EntryKind;
        modifiedAt: string;
        name: string;
        path: string;
        size: number;
        target: string | null;
        targetKind: Exclude<EntryKind, "symlink"> | null;
      }
    >();

    for (const { directory, logicalDir } of theme.searchIndex === false ? [] : plans) {
      for (const entry of directory.entries) {
        if (searchEntries.has(entry.relativePath)) continue;
        const targetLogicalPath =
          entry.symlink?.isBroken || entry.symlink?.isOutsideRoot
            ? null
            : entry.symlink?.targetRelativePath !== null && entry.symlink !== null
              ? entry.symlink.targetRelativePath
              : path.posix.join(logicalDir, entry.name);
        const directoryLike = isDirectoryLike(entry);
        let href: string | null = null;
        if (entry.symlink?.isBroken) {
          const filename = rawLinkFilename(entry);
          rawLinkFiles.set(filename, entry.symlink.target);
          href = `raw-links/${filename}`;
        } else if (targetLogicalPath !== null) {
          href =
            targetLogicalPath === ""
              ? "../"
              : `../${encodeLogicalPath(targetLogicalPath)}${directoryLike ? "/" : ""}`;
        }
        searchEntries.set(entry.relativePath, {
          exitsExplorer:
            entry.symlink?.isBroken === true ||
            (targetLogicalPath !== null &&
              (!directoryLike || !generatedDirectories.has(targetLogicalPath))),
          href,
          isLink: entry.kind === "symlink",
          kind: entry.kind,
          modifiedAt: entry.metadata.times.modifiedAt,
          name: entry.name,
          path: entry.relativePath,
          size: entry.metadata.size,
          target: entry.symlink?.target ?? null,
          targetKind: entry.symlink?.targetKind ?? null,
        });
      }
    }

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
      const hrefForLogicalPath = (targetPath: string, directoryLike: boolean): string => {
        if (urlStrategy === "relative") {
          const relativeTarget = path.posix.relative(
            logicalDir === "" ? "." : logicalDir,
            targetPath === "" ? "." : targetPath,
          );
          const encodedTarget = relativeTarget
            .split("/")
            .map((segment) =>
              segment === "." || segment === ".." ? segment : encodeURIComponent(segment),
            )
            .join("/");
          return `${encodedTarget || "."}${directoryLike ? "/" : ""}`;
        }
        const encodedTarget = encodeLogicalPath(targetPath);
        if (encodedTarget === "") {
          return urlStrategy === "base" ? base : "./";
        }
        const suffix = `${encodedTarget}${directoryLike ? "/" : ""}`;
        return urlStrategy === "base" ? `${base}${suffix}` : suffix;
      };
      const hrefFor = (entry: FileSystemEntry): string | null => {
        if (entry.symlink?.isBroken) {
          const filename = rawLinkFilename(entry);
          rawLinkFiles.set(filename, entry.symlink.target);
          return hrefForLogicalPath(path.posix.join("__dirwell", "raw-links", filename), false);
        }
        const targetLogicalPath = targetLogicalPathFor(entry);
        if (targetLogicalPath === null) return null;
        const directoryLike =
          entry.kind === "directory" || entry.symlink?.targetKind === "directory";
        return hrefForLogicalPath(targetLogicalPath, directoryLike);
      };
      const page = await theme.render({
        directory,
        documentBaseHref: urlStrategy === "html-base" ? base : null,
        outputName: name,
        mode,
        searchIndexHref: hrefForLogicalPath(
          path.posix.join("__dirwell", "search-index.json"),
          false,
        ),
        sort: { ...defaultSort, ...options.sort },
        assetHref: (assetName) => {
          assertSafeOutputName(assetName);
          return hrefForLogicalPath(
            mode === "ssg"
              ? path.posix.join(logicalDir, assetName)
              : path.posix.join("__dirwell", assetName),
            false,
          );
        },
        hrefFor,
        hrefForDirectory: (relativePath) => hrefForLogicalPath(relativePath, true),
        exitsExplorerFor: (entry) => {
          if (entry.symlink?.isBroken) return true;
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

    if (rawLinkFiles.size > 0) {
      const rawLinkDirectory = path.join(buildOutputDir, "__dirwell", "raw-links");
      await mkdir(rawLinkDirectory, { recursive: true });
      for (const [filename, target] of rawLinkFiles) {
        await writeFile(path.join(rawLinkDirectory, filename), target);
      }
    }
    if (theme.searchIndex !== false) {
      const generatedAssetDirectory = path.join(buildOutputDir, "__dirwell");
      await mkdir(generatedAssetDirectory, { recursive: true });
      const indexedEntries = [...searchEntries.values()];
      const shards: string[] = [];
      for (let offset = 0; offset < indexedEntries.length; offset += 512) {
        const filename = `search-${String(shards.length).padStart(5, "0")}.json`;
        shards.push(filename);
        await writeFile(
          path.join(generatedAssetDirectory, filename),
          JSON.stringify({ entries: indexedEntries.slice(offset, offset + 512) }),
        );
      }
      await writeFile(
        path.join(generatedAssetDirectory, "search-index.json"),
        JSON.stringify({ count: indexedEntries.length, shards, version: 2 }),
      );
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
