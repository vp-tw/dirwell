import {
  lstat,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createVitePlugin } from "unplugin";
import type { ResolvedConfig, ViteDevServer } from "vite";
import {
  loadDirwellConfig,
  resolveGenerateOptions,
  validateConfig,
  type DirwellConfig,
} from "./config.ts";
import { generateExplorer, generateExplorerSkippingPaths } from "./generator.ts";
import { selectSourcePaths } from "./filters.ts";
import type { GenerateOptions } from "./model.ts";

/** Dirwell configuration with an output path relative to the Vite project root or absolute. */
export type DirwellViteOptions = Omit<DirwellConfig, "extends" | "server">;

const ownershipMarker = ".dirwell-vite-output";
const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

async function canonicalPath(candidate: string): Promise<string> {
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

function mountPath(base: string): string {
  const pathname = /^https?:\/\//i.test(base) ? new URL(base).pathname : base;
  if (!pathname.startsWith("/")) throw new TypeError("Dirwell base must be an absolute URL path");
  return `${pathname.replace(/\/+$/, "")}/`;
}

function defaultBase(config: ResolvedConfig, relativeOutput: string): string {
  const viteBase = config.base;
  if (!viteBase.startsWith("/") && !/^https?:\/\//i.test(viteBase)) {
    throw new TypeError("Set Dirwell base when Vite uses a relative base");
  }
  const suffix = relativeOutput.split(path.sep).map(encodeURIComponent).join("/");
  return `${viteBase.replace(/\/+$/, "")}/${suffix}/`;
}

async function assertOwnedDestination(outputDir: string): Promise<void> {
  let info;
  try {
    info = await lstat(outputDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error(`Dirwell outDir is not an owned directory: ${outputDir}`);
  }
  let marker: string;
  try {
    marker = await readFile(path.join(outputDir, ownershipMarker), "utf8");
  } catch {
    throw new Error(`Dirwell refuses to replace an unowned outDir: ${outputDir}`);
  }
  if (marker !== "dirwell-vite-v1\n") {
    throw new Error(`Dirwell refuses to replace an unowned outDir: ${outputDir}`);
  }
}

async function assertSafeMirroredSymlinks(options: GenerateOptions): Promise<void> {
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

interface RuntimeOptions {
  readonly sourceDir: string;
  readonly sourceReal: string;
  readonly outputDir: string;
  readonly base: string;
  readonly generate: Parameters<typeof generateExplorer>[0];
}

interface PluginDestination {
  readonly outputDir: string;
  readonly publicMount: string;
}

function createDirwellPlugin(
  inlineOptions: DirwellViteOptions | undefined,
  destinations?: PluginDestination[],
): import("vite").Plugin {
  const factory = createVitePlugin<DirwellViteOptions | undefined, false>(() => {
    let viteConfig: ResolvedConfig;
    let runtime: RuntimeOptions;
    let server: ViteDevServer | undefined;
    let temporary: string | undefined;
    let temporaryReal: string | undefined;
    let pending = Promise.resolve();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let watchListener: ((event: string, changedPath: string) => void) | undefined;

    async function rebuild(): Promise<void> {
      if (closed || temporary === undefined) return;
      try {
        if (runtime.generate.mirror !== false) {
          await assertSafeMirroredSymlinks(runtime.generate);
        }
        await generateExplorerSkippingPaths({ ...runtime.generate, outputDir: temporary }, [
          runtime.outputDir,
        ]);
        server?.ws.send({ type: "full-reload" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        server?.config.logger.error(`Dirwell rebuild failed: ${message}`);
        server?.ws.send({
          type: "error",
          err: { message, stack: error instanceof Error ? (error.stack ?? message) : message },
        });
      }
    }

    return {
      name: "dirwell:vite",
      vite: {
        async configResolved(config) {
          viteConfig = config;
          const projectRoot = path.resolve(config.root);
          const viteOutput = path.resolve(projectRoot, config.build.outDir);
          const { config: fileConfig } = await loadDirwellConfig(
            projectRoot,
            config.command === "build" ? "build" : "serve",
          );
          const merged = { urls: "base" as const, ...fileConfig, ...inlineOptions };
          validateConfig(merged);
          const outputDir = path.resolve(
            projectRoot,
            merged.outDir ?? path.join(config.build.outDir, "dirwell"),
          );
          const canonicalOutput = await canonicalPath(outputDir);
          const canonicalViteOutput = await canonicalPath(viteOutput);
          if (isWithin(canonicalOutput, canonicalViteOutput)) {
            throw new Error("Dirwell outDir must not contain the Vite build output directory");
          }
          const relativeOutput = path.relative(canonicalViteOutput, canonicalOutput);
          const insideViteOutput = isWithin(canonicalViteOutput, canonicalOutput);
          if (!insideViteOutput && merged.base === undefined) {
            throw new Error("Dirwell base is required when outDir is outside Vite build.outDir");
          }
          const base = merged.base ?? defaultBase(config, relativeOutput);
          const publicMount = mountPath(base);
          if (destinations !== undefined) {
            for (const destination of destinations) {
              if (
                isWithin(destination.outputDir, canonicalOutput) ||
                isWithin(canonicalOutput, destination.outputDir)
              ) {
                throw new Error("Dirwell options array has overlapping outDir paths");
              }
              if (
                publicMount.startsWith(destination.publicMount) ||
                destination.publicMount.startsWith(publicMount)
              ) {
                throw new Error("Dirwell options array has overlapping base paths");
              }
            }
            destinations.push({ outputDir: canonicalOutput, publicMount });
          }
          const hostMount =
            config.base.startsWith("/") || /^https?:\/\//i.test(config.base)
              ? mountPath(config.base)
              : null;
          if (publicMount === "/" || publicMount === hostMount) {
            throw new Error("Dirwell base must use a dedicated path within the Vite server");
          }
          const generate = resolveGenerateOptions(projectRoot, {
            ...merged,
            base,
            outDir: outputDir,
          });
          if (isWithin(canonicalOutput, await canonicalPath(generate.sourceDir))) {
            throw new Error("Dirwell outDir must not contain the source directory");
          }
          runtime = {
            sourceDir: generate.sourceDir,
            sourceReal: await canonicalPath(generate.sourceDir),
            outputDir,
            base,
            generate,
          };
        },
        async writeBundle() {
          if (viteConfig.command !== "build" || viteConfig.build.ssr) return;
          await assertOwnedDestination(runtime.outputDir);
          if (runtime.generate.mirror !== false) {
            await assertSafeMirroredSymlinks(runtime.generate);
          }
          await generateExplorer(runtime.generate);
          await writeFile(path.join(runtime.outputDir, ownershipMarker), "dirwell-vite-v1\n");
        },
        async configureServer(viteServer) {
          server = viteServer;
          closed = false;
          temporary = await mkdtemp(path.join(tmpdir(), "dirwell-vite-"));
          temporaryReal = await realpath(temporary);
          try {
            if (runtime.generate.mirror !== false) {
              await assertSafeMirroredSymlinks(runtime.generate);
            }
            await generateExplorerSkippingPaths({ ...runtime.generate, outputDir: temporary }, [
              runtime.outputDir,
            ]);
          } catch (error) {
            await rm(temporary, { recursive: true, force: true });
            temporary = undefined;
            temporaryReal = undefined;
            throw error;
          }
          const publicMount = mountPath(runtime.base);
          viteServer.middlewares.use(async (request, response, next) => {
            const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
            if (pathname === publicMount.slice(0, -1)) {
              response.writeHead(308, { location: publicMount }).end();
              return;
            }
            if (!pathname.startsWith(publicMount)) return next();
            let relative: string;
            try {
              relative = decodeURIComponent(pathname.slice(publicMount.length));
            } catch {
              response.writeHead(400).end("Invalid path");
              return;
            }
            let filePath = path.resolve(temporary!, relative);
            if (!isWithin(temporary!, filePath)) {
              response.writeHead(403).end("Forbidden");
              return;
            }
            try {
              if ((await stat(filePath)).isDirectory())
                filePath = path.join(filePath, "index.html");
              if (!isWithin(temporaryReal!, await realpath(filePath))) {
                response.writeHead(403).end("Forbidden");
                return;
              }
              const fileStats = await stat(filePath);
              if (!fileStats.isFile()) {
                response.writeHead(404).end("Not found");
                return;
              }
              const extension = path.extname(filePath).toLowerCase();
              const headers: Record<string, string | number> = {
                "cache-control": "no-store",
                "content-type": contentTypes[extension] ?? "application/octet-stream",
              };
              if (extension === ".html") {
                const clientPath = `${mountPath(viteServer.config.base)}@vite/client`;
                const html = await readFile(filePath, "utf8");
                const client = `<script type="module" src="${clientPath}"></script>`;
                const contents = html.includes("</body>")
                  ? html.replace("</body>", `${client}</body>`)
                  : `${html}${client}`;
                response.writeHead(200, headers).end(contents);
                return;
              }
              headers["content-length"] = fileStats.size;
              response.writeHead(200, headers);
              createReadStream(filePath)
                .on("error", (error) => response.destroy(error))
                .pipe(response);
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                response.writeHead(404).end("Not found");
                return;
              }
              next(error);
            }
          });
          watchListener = (_event, changedPath) => {
            const changed = path.resolve(changedPath);
            if (!isWithin(runtime.sourceDir, changed) && !isWithin(runtime.sourceReal, changed))
              return;
            if (timer !== undefined) clearTimeout(timer);
            timer = setTimeout(() => {
              pending = pending.then(rebuild);
            }, 75);
          };
          viteServer.watcher.add(runtime.sourceDir);
          viteServer.watcher.on("all", watchListener);
        },
        async closeServer() {
          closed = true;
          if (timer !== undefined) clearTimeout(timer);
          if (watchListener !== undefined) server?.watcher.off("all", watchListener);
          await pending;
          if (temporary !== undefined) await rm(temporary, { recursive: true, force: true });
          temporary = undefined;
          temporaryReal = undefined;
        },
      },
    };
  });
  return factory(inlineOptions) as import("vite").Plugin;
}

export default function dirwellVite(options?: DirwellViteOptions): import("vite").Plugin;
export default function dirwellVite(
  options: readonly DirwellViteOptions[],
): import("vite").Plugin[];
export default function dirwellVite(
  options?: DirwellViteOptions | readonly DirwellViteOptions[],
): import("vite").Plugin | import("vite").Plugin[] {
  if (Array.isArray(options)) {
    if (options.length === 0) throw new TypeError("Dirwell options array must not be empty");
    const destinations: PluginDestination[] = [];
    return options.map((entry) => createDirwellPlugin(entry, destinations));
  }
  return createDirwellPlugin(options as DirwellViteOptions | undefined);
}
