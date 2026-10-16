import { sizeValue } from "./format.ts";
import { validateGenerateOptions } from "./validation.ts";
import {
  resolveDirectoryUrls,
  directoryRoute,
  createHrefResolver,
  encodeLogicalPath,
} from "./routing.ts";
import { copyJsonObject } from "./json.ts";
import { describeEntry, isInsideRoot } from "./filesystem.ts";
import {
  listingRevision,
  projectListingEntry,
  entryDataFacts,
  validateListingPlan,
  type ListingManifest,
} from "./listing.ts";
import {
  cp,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import type {
  DirectoryData,
  EntryKind,
  ExplorerTheme,
  FileSystemEntry,
  GenerateOptions,
  NameSortMode,
  OutputNameResolver,
  SortOptions,
  ThemeContext,
} from "./model.ts";
import { selectSourcePaths } from "./filters.ts";
import {
  checkOutput,
  publishOutput,
  outputMarker,
  outputMarkerContents,
  lockOutput,
  canonicalPath,
} from "./publication.ts";
import type { BuildReport } from "./model.ts";

const indexPattern = /^index\.html?$/i;

const defaultSort = {
  direction: "asc",
  directoriesFirst: true,
  field: "name",
  nameMode: "natural",
} as const satisfies Required<SortOptions>;

export const defaultOutputName: OutputNameResolver = ({ entries }) =>
  entries.some((entry) => indexPattern.test(entry.name))
    ? entries.some((entry) => entry.name.toLowerCase() === "_dirwell.html")
      ? null
      : "_dirwell.html"
    : "index.html";

function assertSafeOutputName(name: string): void {
  if (
    name.length === 0 ||
    name.includes("\\") ||
    Array.from(name).some((character) => character.charCodeAt(0) < 32) ||
    path.basename(name) !== name ||
    name === "." ||
    name === ".."
  ) {
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

function isDirectoryLike(entry: FileSystemEntry): boolean {
  return entry.kind === "directory" || entry.symlink?.targetKind === "directory";
}

function isUnavailableSymlink(entry: FileSystemEntry): boolean {
  return Boolean(
    entry.symlink?.isBroken || entry.symlink?.isOutsideRoot || entry.symlink?.isTargetExcluded,
  );
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
  } else if (resolved.field === "size" || resolved.field === "targetSize") {
    const value = (entry: FileSystemEntry) =>
      sizeValue(
        {
          kind: entry.kind,
          size: entry.metadata.size,
          link:
            entry.symlink === null
              ? null
              : {
                  targetKind: entry.symlink.targetKind,
                  targetSize: entry.symlink.targetSize ?? null,
                  unavailable:
                    entry.symlink.isBroken ||
                    entry.symlink.isOutsideRoot ||
                    Boolean(entry.symlink.isTargetExcluded),
                },
        },
        resolved.field === "targetSize" ? "target" : "entry",
      );
    const a = value(left),
      b = value(right);
    if ((a === null) !== (b === null)) return a === null ? 1 : -1;
    result = (a ?? 0) - (b ?? 0);
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

export async function generateExplorer(options: GenerateOptions): Promise<BuildReport> {
  return generateExplorerSkippingPaths(options, []);
}

/** Internal entry point for hosts that stage previews outside their published output. */
export async function generateExplorerSkippingPaths(
  options: GenerateOptions,
  ignoredPaths: readonly string[],
): Promise<BuildReport> {
  validateGenerateOptions(options);
  const source = path.resolve(options.sourceDir),
    output = path.resolve(options.outputDir);
  await checkOutput(source, output, options.outputPolicy);
  if (options.dryRun) return generateExplorerUnlocked(options, ignoredPaths);
  const lock = await lockOutput(output);
  const lexicalLock = path.join(path.dirname(output), path.basename(lock.lockPath));
  try {
    return await generateExplorerUnlocked(options, [...ignoredPaths, lock.lockPath, lexicalLock]);
  } finally {
    await lock.release();
  }
}

async function generateExplorerUnlocked(
  options: GenerateOptions,
  ignoredPaths: readonly string[],
): Promise<BuildReport> {
  const sourceDir = await realpath(path.resolve(options.sourceDir));
  const outputDir = await canonicalPath(path.resolve(options.outputDir));
  const ignoredSourcePaths = ignoredPaths.map((value) => path.resolve(value));
  const rootRealPath = await realpath(sourceDir);
  const replacesOutput = await checkOutput(sourceDir, outputDir, options.outputPolicy);
  const outputName = options.outputName ?? defaultOutputName;
  const resolveOutputName: OutputNameResolver =
    typeof outputName === "string" ? () => outputName : outputName;
  const theme: ExplorerTheme = options.theme;
  if (theme === undefined) throw new TypeError("Core requires an explicit theme");
  const directoryUrls = resolveDirectoryUrls(options.routing);
  const mode = options.mode ?? "ssg";
  const urlStrategy = options.urlStrategy ?? "relative";
  const base = normalizeBase(options.base ?? "/");
  const followSymlinks = options.symlinks?.follow ?? false;
  const boundary = options.symlinks?.boundary ?? "root";
  const onCycle = options.symlinks?.onCycle ?? "skip";
  const filtersActive =
    options.include !== undefined ||
    options.exclude !== undefined ||
    (options.ignoreFiles?.length ?? 0) > 0 ||
    ignoredSourcePaths.length > 0;
  const plans: Array<{
    readonly directory: DirectoryData;
    readonly logicalDir: string;
    readonly outputName: string | null;
  }> = [];
  if (isInsideRoot(outputDir, sourceDir)) {
    throw new Error("outputDir must not contain the sourceDir");
  }
  if (
    (await readdir(sourceDir)).some((name) => name.normalize("NFC").toLowerCase() === "__dirwell")
  )
    throw new Error('Dirwell reserves the source-root path "__dirwell"');
  const outputIsWithinSource = isInsideRoot(sourceDir, outputDir);
  const selection = await selectSourcePaths(
    sourceDir,
    outputDir,
    options.include,
    options.exclude,
    ignoredSourcePaths,
    options.ignoreFiles,
  );
  const stageParent = outputIsWithinSource ? path.dirname(sourceDir) : path.dirname(outputDir);
  if (!options.dryRun) await mkdir(stageParent, { recursive: true });
  const stagedOutputDir = options.dryRun
    ? null
    : await mkdtemp(path.join(stageParent, `.${path.basename(outputDir)}-dirwell-`));
  const buildOutputDir = stagedOutputDir!;

  try {
    if (!options.dryRun && (options.mirror ?? true)) {
      await rm(buildOutputDir, { recursive: true, force: true });
      await mkdir(buildOutputDir, { recursive: true });
      await cp(sourceDir, buildOutputDir, {
        recursive: true,
        dereference: false,
        preserveTimestamps: true,
        filter: (sourcePath) => {
          const relativePath = path.relative(sourceDir, sourcePath).split(path.sep).join("/");
          return (
            selection.selected.has(relativePath) &&
            (!selection.symlinks.has(relativePath) || selection.mirroredSymlinks.has(relativePath))
          );
        },
      });
    }
  } catch (error) {
    if (stagedOutputDir !== null) await rm(stagedOutputDir, { recursive: true, force: true });
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
    const names = (await readdir(physicalDir)).filter((name) => {
      if (outputIsWithinSource && isInsideRoot(outputDir, path.join(physicalDir, name)))
        return false;
      if (ignoredSourcePaths.some((value) => isInsideRoot(value, path.join(physicalDir, name))))
        return false;
      if (!filtersActive) return true;
      const relativePath = path.relative(rootRealPath, path.join(physicalRealPath, name));
      return selection.selected.has(relativePath.split(path.sep).join("/"));
    });
    const entries = await Promise.all(
      names.map(async (name) => {
        const entry = await describeEntry({
          absolutePath: path.join(physicalDir, name),
          relativePath: path.posix.join(logicalDir, name),
          rootRealPath,
          ancestors: nextAncestors,
          followSymlinks,
          selectedPaths: filtersActive ? selection.selected : null,
        });
        return options.entryData === undefined
          ? entry
          : {
              ...entry,
              publicData: copyJsonObject(
                await options.entryData(entryDataFacts(entry), {
                  operation: "build",
                  directoryPath: logicalDir,
                }),
              ),
            };
      }),
    );
    entries.sort(
      (left, right) =>
        compareEntries(left, right, options.sort) ||
        (options.listing === undefined ? 0 : compareUnicode(left.relativePath, right.relativePath)),
    );

    const describedCurrent = await describeEntry({
      absolutePath: physicalDir,
      relativePath: logicalDir,
      rootRealPath,
      ancestors,
      followSymlinks,
      selectedPaths: filtersActive ? selection.selected : null,
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
      selectedPaths: filtersActive ? selection.selected : null,
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
            selectedPaths: filtersActive ? selection.selected : null,
          });
    const directory: DirectoryData = {
      root,
      current,
      parent,
      depth: logicalDir === "" ? 0 : logicalDir.split("/").length,
      entries,
    };

    const name = await resolveOutputName(directory);
    if (name !== null) {
      assertSafeOutputName(name);
      if (options.outputName !== undefined && directoryUrls !== "explicit" && name !== "index.html")
        throw new TypeError("Custom outputName requires routing.directoryUrls: explicit");
    }
    plans.push({ directory, logicalDir, outputName: name });

    for (const entry of entries) {
      if (entry.kind === "directory") {
        await visit(path.posix.join(logicalDir, entry.name), entry.absolutePath, nextAncestors);
        continue;
      }
      if (!followSymlinks || entry.symlink?.targetKind !== "directory") continue;
      const physicalLinkPath = path
        .relative(rootRealPath, path.join(physicalRealPath, entry.name))
        .split(path.sep)
        .join("/");
      if ((options.mirror ?? true) && !selection.mirroredSymlinks.has(physicalLinkPath)) continue;
      if (entry.symlink.isCycle) {
        if (onCycle === "error") throw new Error(`Symlink cycle at ${entry.relativePath}`);
        continue;
      }
      if (entry.symlink.resolvedPath === null) continue;
      if (boundary === "root" && entry.symlink.isOutsideRoot) continue;
      if (
        filtersActive &&
        (entry.symlink.targetRelativePath === null ||
          !selection.selected.has(entry.symlink.targetRelativePath))
      )
        continue;
      // Mirrored internal aliases already resolve to the target's generated page.
      // Writing an alias page through the copied symlink would overwrite that page.
      if (
        (options.mirror ?? true) &&
        entry.symlink.targetRelativePath !== null &&
        !entry.symlink.isOutsideRoot
      )
        continue;
      await visit(
        path.posix.join(logicalDir, entry.name),
        entry.symlink.resolvedPath,
        nextAncestors,
      );
    }
  }

  try {
    await visit("", sourceDir, new Set());

    const generatedPages = new Map(
      plans
        .filter((plan) => plan.outputName !== null)
        .map((plan) => [
          plan.logicalDir,
          directoryRoute(plan.logicalDir, plan.outputName!, directoryUrls),
        ]),
    );
    const sourcePaths = new Set(
      [...selection.selected].map((value) => value.normalize("NFC").toLowerCase()),
    );
    const claimedPages = new Set<string>();
    const claimedAssets = new Set<string>();
    const claimPage = (outputPath: string) => {
      const key = outputPath.normalize("NFC").toLowerCase();
      if (
        key === "__dirwell" ||
        key.startsWith("__dirwell/") ||
        sourcePaths.has(key) ||
        claimedPages.has(key) ||
        claimedAssets.has(key)
      )
        throw new Error(`Explorer page conflicts with source or generated output: ${outputPath}`);
      claimedPages.add(key);
    };
    for (const route of generatedPages.values()) claimPage(route.outputPath);
    const ownedDirectories = new Set(
      plans
        .filter(
          (plan) =>
            plan.outputName === null &&
            plan.directory.entries.some(
              (entry) => entry.kind === "file" && indexPattern.test(entry.name),
            ),
        )
        .map((plan) => plan.logicalDir),
    );
    const generatedDirectories = new Set(generatedPages.keys());
    const pagePathForDirectory = (logicalPath: string): string | null =>
      generatedPages.get(logicalPath)?.publicPath ??
      (ownedDirectories.has(logicalPath) ? (logicalPath ? `${logicalPath}/` : "") : null);
    const report: BuildReport = {
      sourceDir,
      outputDir,
      theme: theme.name,
      dryRun: options.dryRun ?? false,
      mirror: options.mirror ?? true,
      replacesOutput,
      selectedPaths: [...selection.selected].filter(Boolean).sort(),
      pages: plans.map((plan) => ({
        directory: plan.logicalDir,
        outputName: plan.outputName,
        outputPath: generatedPages.get(plan.logicalDir)?.outputPath ?? null,
        publicPath: generatedPages.get(plan.logicalDir)?.publicPath ?? null,
      })),
    };
    if (options.dryRun) return report;
    const sourceKinds = new Map<string, string>();
    for (const { directory } of plans)
      for (const entry of directory.entries) {
        const sourcePath = path.relative(sourceDir, entry.absolutePath).split(path.sep).join("/");
        if (selection.selected.has(sourcePath)) sourceKinds.set(sourcePath, entry.kind);
      }
    const metadataResolver = await options.metadata?.({ sourceDir, sourceKinds });
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
        targetSize: number | null;
        isTargetUnavailable: boolean;
        isCycle: boolean;
      }
    >();

    const fileHrefs = new Map<string, string | null>();
    const mappedFileHref = (logicalPath: string): string | null => {
      if (!fileHrefs.has(logicalPath)) {
        const href = options.fileHref!(logicalPath);
        if (
          href !== null &&
          (typeof href !== "string" ||
            href.length === 0 ||
            href.includes("\\") ||
            Array.from(href).some((character) => character.charCodeAt(0) < 32) ||
            !["http:", "https:"].includes(new URL(href, "https://dirwell.invalid/").protocol))
        )
          throw new TypeError(
            "fileHref must return a synchronous HTTP(S), root-relative or relative URL, or null",
          );
        fileHrefs.set(logicalPath, href);
      }
      return fileHrefs.get(logicalPath)!;
    };

    for (const { directory, logicalDir } of theme.searchIndex === false ? [] : plans) {
      for (const entry of directory.entries) {
        if (searchEntries.has(entry.relativePath)) continue;
        const targetLogicalPath = isUnavailableSymlink(entry)
          ? null
          : entry.symlink?.targetRelativePath !== null && entry.symlink !== null
            ? entry.symlink.targetRelativePath
            : path.posix.join(logicalDir, entry.name);
        const directoryLike = isDirectoryLike(entry);
        const linkedPath =
          directoryLike && targetLogicalPath !== null
            ? pagePathForDirectory(targetLogicalPath)
            : targetLogicalPath;
        let href: string | null = null;
        if (entry.symlink !== null && isUnavailableSymlink(entry)) {
          const filename = rawLinkFilename(entry);
          rawLinkFiles.set(filename, entry.symlink.target);
          href = `raw-links/${filename}`;
        } else if (linkedPath !== null) {
          href = createHrefResolver("__dirwell/search-index.json", "relative", base)(linkedPath);
          if (!directoryLike && options.fileHref !== undefined) href = mappedFileHref(linkedPath);
        }
        searchEntries.set(entry.relativePath, {
          exitsExplorer:
            isUnavailableSymlink(entry) ||
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
          targetSize: entry.symlink?.targetSize ?? null,
          isTargetUnavailable: isUnavailableSymlink(entry),
          isCycle: entry.symlink?.isCycle ?? false,
        });
      }
    }

    for (const plan of plans) {
      const { directory, logicalDir, outputName: name } = plan;
      if (name === null) continue;

      const targetLogicalPathFor = (entry: FileSystemEntry): string | null => {
        if (isUnavailableSymlink(entry)) return null;
        if (entry.symlink?.targetRelativePath !== null && entry.symlink !== null) {
          return entry.symlink.targetRelativePath;
        }
        return path.posix.join(logicalDir, entry.name);
      };
      const currentRoute = generatedPages.get(logicalDir)!;
      const hrefForPath = createHrefResolver(currentRoute.publicPath, urlStrategy, base);
      const hrefForDirectory = (targetPath: string) => {
        const target = pagePathForDirectory(targetPath);
        return target === null ? null : hrefForPath(target);
      };
      const assetHrefForDirectory = (targetPath: string, assetName: string) => {
        assertSafeOutputName(assetName);
        return hrefForPath(path.posix.join(mode === "ssg" ? targetPath : "__dirwell", assetName));
      };
      const directoryTargets = new Map(
        directory.entries
          .filter((entry) => isDirectoryLike(entry) && !isUnavailableSymlink(entry))
          .flatMap((entry) => {
            const target = targetLogicalPathFor(entry);
            return target !== null && generatedDirectories.has(target)
              ? [[entry.relativePath, target] as const]
              : [];
          }),
      );
      const directoryPathForEntry = (entryId: string) => directoryTargets.get(entryId) ?? null;
      const hrefFor = (entry: FileSystemEntry): string | null => {
        if (entry.symlink !== null && isUnavailableSymlink(entry)) {
          const filename = rawLinkFilename(entry);
          rawLinkFiles.set(filename, entry.symlink.target);
          return hrefForPath(path.posix.join("__dirwell", "raw-links", filename));
        }
        const targetLogicalPath = targetLogicalPathFor(entry);
        if (targetLogicalPath === null) return null;
        const directoryLike =
          entry.kind === "directory" || entry.symlink?.targetKind === "directory";
        if (!directoryLike && options.fileHref !== undefined)
          return mappedFileHref(targetLogicalPath);
        return directoryLike ? hrefForDirectory(targetLogicalPath) : hrefForPath(targetLogicalPath);
      };
      const baseContext: ThemeContext = {
        operation: "build",
        directory,
        documentBaseHref: urlStrategy === "html-base" ? base : null,
        outputName: name,
        mode,
        searchIndexHref: hrefForPath("__dirwell/search-index.json"),
        sort: { ...defaultSort, ...options.sort },
        assetHref: (assetName) => assetHrefForDirectory(logicalDir, assetName),
        hrefFor,
        hrefForDirectory,
        assetHrefForDirectory,
        directoryPathForEntry,
        hasPageForDirectory: (relativePath) => generatedDirectories.has(relativePath),
        exitsExplorerFor: (entry) => {
          if (isUnavailableSymlink(entry)) return true;
          const targetLogicalPath = targetLogicalPathFor(entry);
          const directoryLike =
            entry.kind === "directory" || entry.symlink?.targetKind === "directory";
          return (
            targetLogicalPath !== null &&
            (!directoryLike || !generatedDirectories.has(targetLogicalPath))
          );
        },
      };
      const targetDir = path.join(buildOutputDir, logicalDir);
      await mkdir(targetDir, { recursive: true });
      const sort = baseContext.sort;
      let revision = "";
      let manifestHref = "";
      let pageSize = Math.max(1, directory.entries.length);
      if (options.listing !== undefined) {
        const records = directory.entries.map((entry) => {
          const projected = projectListingEntry(entry, baseContext);
          return theme.entryData === undefined
            ? projected
            : {
                ...projected,
                presentation: copyJsonObject(
                  theme.entryData(projected, {
                    mode: baseContext.mode,
                    outputName: baseContext.outputName,
                    assetHref: baseContext.assetHref,
                    hrefForDirectory: baseContext.hrefForDirectory,
                    assetHrefForDirectory,
                    directoryPathForEntry,
                    documentBaseHref: baseContext.documentBaseHref,
                    directoryPath: logicalDir,
                  }),
                ),
              };
        });
        const candidate =
          typeof options.listing === "function"
            ? options.listing({
                directoryPath: logicalDir,
                visibleCount: records.length,
                dataBytes: Buffer.byteLength(JSON.stringify(records)),
                mode,
                operation: "build",
                supportsPagination: theme.listing?.pagination === true,
              })
            : options.listing;
        validateListingPlan(candidate);
        if (candidate.html.strategy === "paged") {
          if (theme.listing?.pagination !== true)
            throw new Error(`Theme ${theme.name} does not support listing pagination`);
          pageSize = candidate.html.pageSize;
        }
        const directoryId = createHash("sha256").update(logicalDir).digest("hex");
        const manifestDirectory = path.posix.join("__dirwell", "listing", directoryId);
        // Relative records belong to the document directory, not to the JSON asset directory.
        const documentDirectory = currentRoute.publicPath.endsWith("/")
          ? currentRoute.publicPath
          : path.posix.dirname(currentRoute.publicPath || ".");
        const hrefBase =
          urlStrategy === "relative"
            ? `../../../${documentDirectory === "." ? "" : `${encodeLogicalPath(documentDirectory.replace(/\/$/, ""))}/`}`
            : base;
        const manifestPath = path.posix.join(manifestDirectory, "manifest.json");
        manifestHref = hrefForPath(manifestPath);
        const blocks: Array<ListingManifest["blocks"][number]> = [];
        const blockSize =
          candidate.data.strategy === "blocks"
            ? candidate.data.blockSize
            : Math.max(1, records.length);
        revision = listingRevision(records, sort, hrefBase, blockSize);
        const outputListingDir = path.join(buildOutputDir, manifestDirectory);
        await mkdir(outputListingDir, { recursive: true });
        for (let offset = 0; offset < records.length || offset === 0; offset += blockSize) {
          const entries = records.slice(offset, offset + blockSize);
          const filename = `${revision}-${blocks.length}.json`;
          blocks.push({ href: filename, offset, count: entries.length });
          await writeFile(
            path.join(outputListingDir, filename),
            JSON.stringify({ version: 1, revision, offset, total: records.length, entries }),
          );
        }
        const manifest: ListingManifest = {
          version: 1,
          revision,
          directory: logicalDir,
          hrefBase,
          total: records.length,
          sort,
          blocks,
        };
        await writeFile(path.join(outputListingDir, "manifest.json"), JSON.stringify(manifest));
      }
      const pageCount = Math.max(1, Math.ceil(directory.entries.length / pageSize));
      const pagePrefix = `__dirwell-page-${createHash("sha256").update(name).digest("hex").slice(0, 16)}`;
      const pageNames = Array.from({ length: pageCount }, (_, index) =>
        index === 0 ? name : `${pagePrefix}-${index + 1}.html`,
      );
      const pageRoutes = pageNames.map((pageName, index) =>
        directoryRoute(
          logicalDir,
          pageName,
          name === "index.html" ? directoryUrls : "explicit",
          index + 1,
        ),
      );
      for (const route of pageRoutes.slice(1)) claimPage(route.outputPath);
      const pagedAssets = new Map<string, Buffer>();
      for (const [index, pageName] of pageNames.entries()) {
        const pageRoute = pageRoutes[index]!;
        const metadata = await metadataResolver?.resolve(
          directory,
          (outputPath) => hrefForPath(outputPath),
          pageRoute.publicPath,
        );
        const pageHref = (number: number): string =>
          hrefForPath(pageRoutes[number]?.publicPath ?? currentRoute.publicPath);
        const page = await theme.render({
          ...baseContext,
          ...(metadata === undefined ? {} : { metadata }),
          outputName: pageName,
          directory:
            options.listing === undefined
              ? directory
              : {
                  ...directory,
                  entries: directory.entries.slice(index * pageSize, (index + 1) * pageSize),
                },
          ...(options.listing === undefined
            ? {}
            : {
                listing: {
                  revision,
                  manifestHref,
                  page: {
                    number: index + 1,
                    count: pageCount,
                    offset: index * pageSize,
                    total: directory.entries.length,
                    href: pageHref(index),
                    previousHref: index === 0 ? null : pageHref(index - 1),
                    nextHref: index + 1 === pageCount ? null : pageHref(index + 1),
                  },
                },
              }),
        });
        const pageDestination = path.join(buildOutputDir, pageRoute.outputPath);
        await mkdir(path.dirname(pageDestination), { recursive: true });
        await writeFile(pageDestination, page.html);
        for (const [assetName, contents] of Object.entries(page.assets ?? {})) {
          assertSafeOutputName(assetName);
          const assetPathKey = path.posix
            .join(mode === "ssg" ? logicalDir : "__dirwell", assetName)
            .normalize("NFC")
            .toLowerCase();
          if (sourcePaths.has(assetPathKey))
            throw new Error(`Theme asset conflicts with source entry: ${assetName}`);
          if (claimedPages.has(assetPathKey))
            throw new Error(`Theme asset conflicts with listing page: ${assetName}`);
          claimedAssets.add(assetPathKey);
          if (options.listing !== undefined && pageCount > 1) {
            const bytes = Buffer.from(contents);
            const existing = pagedAssets.get(assetName);
            if (existing !== undefined && !existing.equals(bytes))
              throw new Error(`Theme emitted conflicting paginated asset: ${assetName}`);
            pagedAssets.set(assetName, bytes);
          }
          if (mode === "ssg") {
            await writeFile(path.join(targetDir, assetName), contents);
          } else {
            const bytes = Buffer.from(contents);
            const existing = sharedAssets.get(assetName);
            if (existing !== undefined && !Buffer.from(existing).equals(bytes)) {
              throw new Error(`Theme emitted conflicting shared asset: ${assetName}`);
            }
            sharedAssets.set(assetName, bytes);
          }
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

    for (const [filename, bytes] of metadataResolver?.assets ?? []) {
      const parts = filename.split("/");
      for (let index = 1; index <= parts.length; index++) {
        const prefix = parts.slice(0, index).join("/");
        if (selection.selected.has(prefix))
          throw new Error(`Metadata image conflicts with source entry: ${filename}`);
        const candidate = path.join(buildOutputDir, prefix);
        try {
          const info = await lstat(candidate);
          if (info.isSymbolicLink() || index === parts.length || !info.isDirectory())
            throw new Error(`Metadata image conflicts with generated output: ${filename}`);
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        }
      }
      const destination = path.join(buildOutputDir, filename);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
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
        JSON.stringify({ count: indexedEntries.length, shards, version: 3 }),
      );
    }

    await mkdir(path.join(buildOutputDir, "__dirwell"), { recursive: true });
    await writeFile(path.join(buildOutputDir, outputMarker), outputMarkerContents);
    await publishOutput(buildOutputDir, outputDir, sourceDir, options.outputPolicy);
    return report;
  } finally {
    if (stagedOutputDir !== null) await rm(stagedOutputDir, { recursive: true, force: true });
  }
}

export async function readGeneratedPage(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}
