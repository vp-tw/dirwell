import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { watch, type FSWatcher } from "chokidar";
import { createUnplugin, type UnpluginOptions, type UnpluginInstance } from "unplugin";
import {
  loadDirwellConfig,
  resolveGenerateOptions,
  validateConfig,
  type DirwellConfig,
} from "./config.ts";
import { generateExplorerSkippingPaths } from "./generator.ts";
import dirwellVite from "./vite.ts";
import { assertSafeMirroredSymlinks, canonicalPath, isWithin } from "./plugin-safety.ts";

/** A directory explorer emitted beneath the host's output root. */
export interface DirwellPluginOptions extends Omit<DirwellConfig, "extends" | "server" | "outDir"> {
  /** Project directory used for config discovery and relative source paths. */
  readonly cwd?: string;
  /** Dedicated relative path inside the host output; defaults to `dirwell`. */
  readonly outputPath?: string;
}

export type DirwellPluginInput = DirwellPluginOptions | readonly DirwellPluginOptions[] | undefined;
interface PreviewContext {
  path: string;
  status: number;
  type: string;
  respond: boolean;
  body?: string | Uint8Array;
  req: IncomingMessage;
  res: ServerResponse;
  redirect(path: string): void;
  set(name: string, value: string): void;
}
const marker = ".dirwell-plugin-output";

function outputPath(value = "dirwell"): string {
  if (
    !value ||
    path.isAbsolute(value) ||
    value.includes("\\") ||
    value.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new TypeError(
      "Dirwell outputPath must be a dedicated relative path without dot segments",
    );
  }
  return value;
}

async function watchPaths(
  source: string,
  excluded: readonly string[],
): Promise<{ files: string[]; directories: string[] }> {
  const files: string[] = [];
  const directories: string[] = [];
  async function visit(directory: string): Promise<void> {
    directories.push(directory);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = path.join(directory, entry.name);
      if (excluded.some((candidate) => isWithin(candidate, name))) continue;
      if (entry.isDirectory()) await visit(name);
      else files.push(name);
    }
  }
  await visit(source);
  return { files, directories };
}

const core = createUnplugin<DirwellPluginInput, true>((options, meta) => {
  const entries = Array.isArray(options) ? options : [options ?? {}];
  if (!entries.length) throw new TypeError("Dirwell options array must not be empty");
  const prefixes = entries.map((entry) => outputPath(entry.outputPath));
  for (let index = 0; index < prefixes.length; index++) {
    for (let other = 0; other < index; other++) {
      if (
        isWithin(prefixes[index]!, prefixes[other]!) ||
        isWithin(prefixes[other]!, prefixes[index]!)
      ) {
        throw new Error("Dirwell options array has overlapping outputPath paths");
      }
    }
  }
  return entries.map((inline, index): UnpluginOptions => {
    const prefix = prefixes[index]!;
    if (meta.framework === "vite")
      return { name: `dirwell:${prefix}`, vite: dirwellVite({ ...inline, outputPath: prefix }) };
    let cwd = path.resolve(inline.cwd ?? process.cwd());
    let hostOutput: string | undefined;
    let config: DirwellConfig;
    let source: string;
    let context: {
      emitFile(asset: { type: "asset"; fileName: string; source: string | Uint8Array }): unknown;
    };
    let failed = false;
    let previousFiles: string[] = [];
    let emittedFiles = new Set<string>();
    let sourceWatcher: FSWatcher | undefined;
    let watchDirectory: string | undefined;
    let sentinel: string | undefined;
    let revision = 0;
    let sentinelWrites = Promise.resolve();
    let sentinelTimer: ReturnType<typeof setTimeout> | undefined;
    const virtual = `dirwell-watch:${index}:${prefix}`;

    async function prepare(): Promise<void> {
      const loaded = await loadDirwellConfig(cwd, "build");
      config = { ...loaded.config, ...inline };
      validateConfig(config);
      source = path.resolve(cwd, config.root ?? ".");
    }

    async function paths() {
      return watchPaths(source, hostOutput === undefined ? [] : [hostOutput]);
    }

    async function emit(target: {
      emitFile(asset: { type: "asset"; fileName: string; source: string | Uint8Array }): unknown;
    }): Promise<void> {
      if (failed) return;
      if (hostOutput === undefined) throw new Error("Dirwell requires a host output directory");
      const destination = path.join(hostOutput, prefix);
      if (isWithin(await canonicalPath(destination), await realpath(source))) {
        throw new Error("Dirwell outputPath must not contain the source directory");
      }
      previousFiles = [];
      try {
        if ((await lstat(destination)).isSymbolicLink())
          throw new Error("Dirwell refuses a symlink outputPath");
        const existing = await readdir(destination);
        if (existing.length) {
          const value: unknown = JSON.parse(
            await readFile(path.join(destination, marker), "utf8").catch(() => "null"),
          );
          if (
            typeof value !== "object" ||
            value === null ||
            !("version" in value) ||
            value.version !== 1 ||
            !("files" in value) ||
            !Array.isArray(value.files) ||
            !value.files.every((file): file is string => typeof file === "string")
          ) {
            throw new Error(`Dirwell refuses to replace an unowned outputPath: ${destination}`);
          }
          previousFiles = value.files.map(outputPath);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const temporary = await mkdtemp(path.join(tmpdir(), "dirwell-plugin-"));
      try {
        const generate = resolveGenerateOptions(cwd, { ...config, outDir: temporary });
        if (generate.mirror !== false) await assertSafeMirroredSymlinks(generate);
        await generateExplorerSkippingPaths(generate, [hostOutput]);
        const generated = await watchPaths(temporary, []);
        emittedFiles = new Set(
          generated.files.map((file) => path.relative(temporary, file).split(path.sep).join("/")),
        );
        for (const file of generated.files) {
          target.emitFile({
            type: "asset",
            fileName: `${prefix}/${path.relative(temporary, file).split(path.sep).join("/")}`,
            source: await readFile(file),
          });
        }
        target.emitFile({
          type: "asset",
          fileName: `${prefix}/${marker}`,
          source: JSON.stringify({ version: 1, files: [...emittedFiles] }),
        });
      } finally {
        await rm(temporary, { recursive: true, force: true });
      }
    }

    async function removeStaleFiles(): Promise<void> {
      if (failed || hostOutput === undefined) return;
      const destination = path.join(hostOutput, prefix);
      const canonicalDestination = await canonicalPath(destination);
      for (const file of previousFiles) {
        if (emittedFiles.has(file)) continue;
        const stale = path.join(destination, file);
        if (!isWithin(canonicalDestination, await canonicalPath(path.dirname(stale))))
          throw new Error("Dirwell refuses to remove a stale asset through a symlink");
        await rm(stale, { force: true });
      }
      previousFiles = [];
    }

    return {
      name: `dirwell:${prefix}`,
      async buildStart() {
        context = { emitFile: (asset) => this.emitFile(asset) };
        failed = false;
        const native = this.getNativeBuildContext?.();
        if (native?.framework === "webpack" || native?.framework === "rspack") {
          if (inline.cwd === undefined) cwd = native.compiler.context;
          hostOutput = native.compiler.options.output.path;
        }
        await prepare();
        if (
          meta.framework === "rolldown" &&
          "meta" in this &&
          typeof this.meta === "object" &&
          this.meta !== null &&
          "watchMode" in this.meta &&
          this.meta.watchMode
        ) {
          if (sourceWatcher === undefined) {
            watchDirectory = await mkdtemp(path.join(tmpdir(), "dirwell-watch-"));
            sentinel = path.join(watchDirectory, "revision.js");
            await writeFile(sentinel, "export {};\n");
            sourceWatcher = watch(source, {
              ignoreInitial: true,
              followSymlinks: false,
              ignored: (name) => hostOutput !== undefined && isWithin(hostOutput, name),
            });
            await new Promise<void>((resolve, reject) => {
              sourceWatcher!.once("ready", resolve);
              sourceWatcher!.once("error", reject);
            });
            const notify = () => {
              clearTimeout(sentinelTimer);
              sentinelTimer = setTimeout(() => {
                sentinelWrites = sentinelWrites
                  .then(() => writeFile(sentinel!, `// ${++revision}\nexport {};\n`))
                  .catch((error) => console.error("Dirwell watch failed", error));
              }, 50);
            };
            sourceWatcher.on("all", notify);
            // A rapid add/unlink can precede Chokidar's per-file watcher registration.
            // Parent-directory rename events still identify that tree change.
            sourceWatcher.on("raw", (event: string, name: string, details: unknown) => {
              if (
                event !== "rename" ||
                typeof name !== "string" ||
                typeof details !== "object" ||
                details === null ||
                !("watchedPath" in details) ||
                typeof details.watchedPath !== "string"
              )
                return;
              const changed = path.isAbsolute(name)
                ? name
                : path.basename(details.watchedPath) === name
                  ? details.watchedPath
                  : path.resolve(details.watchedPath, name);
              if (
                isWithin(source, changed) &&
                (hostOutput === undefined || !isWithin(hostOutput, changed))
              )
                notify();
            });
          }
          this.addWatchFile(sentinel!);
        }
        if (meta.framework !== "esbuild" && meta.framework !== "bun") {
          const watched = await paths();
          if (native?.framework === "webpack" || native?.framework === "rspack") {
            for (const directory of watched.directories)
              native.compilation?.contextDependencies.add(directory);
          } else {
            for (const directory of watched.directories) this.addWatchFile(directory);
          }
          for (const file of watched.files) this.addWatchFile(file);
          if (native?.framework === "webpack" || native?.framework === "rspack") {
            native.compilation?.hooks.processAssets.tapPromise(
              {
                name: `dirwell:${prefix}`,
                stage: native.compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
              },
              async () => {
                if (!native.compilation?.errors.length)
                  await emit({ emitFile: (asset) => this.emitFile(asset) });
              },
            );
          }
        }
      },
      async buildEnd() {
        if (
          ![
            "rollup",
            "rolldown",
            "unloader",
            "esbuild",
            "bun",
            "webpack",
            "rspack",
            "rsbuild",
          ].includes(meta.framework)
        )
          await emit(this);
      },
      async writeBundle() {
        await removeStaleFiles();
      },
      rollup: {
        async generateBundle(output) {
          hostOutput = path.resolve(
            cwd,
            output.dir ?? path.dirname(output.file ?? "dist/index.js"),
          );
          await emit(this);
        },
      },
      rolldown: {
        transform(code, id) {
          if (sentinel === undefined || !this.getModuleInfo(id)?.isEntry) return null;
          return { code: `import ${JSON.stringify(sentinel)};\n${code}`, map: null };
        },
        async closeWatcher() {
          await sourceWatcher?.close();
          clearTimeout(sentinelTimer);
          await sentinelWrites;
          sourceWatcher = undefined;
          if (watchDirectory !== undefined)
            await rm(watchDirectory, { recursive: true, force: true });
          watchDirectory = undefined;
          sentinel = undefined;
        },
        async generateBundle(output) {
          hostOutput = path.resolve(
            cwd,
            output.dir ?? path.dirname(output.file ?? "dist/index.js"),
          );
          await emit(this);
        },
      },
      webpack(compiler) {
        compiler.hooks.shouldEmit.tap(`dirwell:${prefix}`, (compilation) => {
          failed = compilation.errors.length > 0;
        });
      },
      rspack(compiler) {
        compiler.hooks.shouldEmit.tap(`dirwell:${prefix}`, (compilation) => {
          failed = compilation.errors.length > 0;
        });
      },
      farm: {
        configResolved(resolved) {
          if (inline.cwd === undefined) cwd = resolved.compilation?.root ?? cwd;
          hostOutput = path.resolve(cwd, resolved.compilation?.output?.path ?? "dist");
        },
        configureDevServer(server) {
          let assets = new Map<string, string | Uint8Array>();
          let pending = Promise.resolve();
          let timer: ReturnType<typeof setTimeout> | undefined;
          let closed = false;
          const clients = new Set<ServerResponse>();
          async function rebuild() {
            if (closed) return;
            const next = new Map<string, string | Uint8Array>();
            await prepare();
            await emit({
              emitFile(asset) {
                next.set(asset.fileName, asset.source);
              },
            });
            assets = next;
            for (const client of clients) client.write("event: reload\ndata: updated\n\n");
          }
          const ready = (async () => {
            await rebuild();
            sourceWatcher = watch(source, {
              ignoreInitial: true,
              followSymlinks: false,
              ignored: (name) => hostOutput !== undefined && isWithin(hostOutput, name),
            });
            await new Promise<void>((resolve, reject) => {
              sourceWatcher!.once("ready", resolve);
              sourceWatcher!.once("error", reject);
            });
            sourceWatcher.on("all", () => {
              clearTimeout(timer);
              timer = setTimeout(() => {
                pending = pending
                  .then(rebuild)
                  .catch((error) =>
                    server.logger.error(`Dirwell rebuild failed: ${String(error)}`),
                  );
              }, 75);
            });
          })();
          void ready.catch((error) =>
            server.logger.error(`Dirwell preview failed: ${String(error)}`),
          );
          // Farm does not await configureDevServer; await readiness in its middleware.
          server
            .app()
            .use(async (ctx: PreviewContext, next: () => Promise<unknown>): Promise<void> => {
              await ready;
              const base = `${new URL(server.publicPath ?? "/", "http://dirwell.local").pathname.replace(/\/+$/, "")}/${prefix}/`;
              if (ctx.path === base.slice(0, -1)) {
                ctx.redirect(base);
                return;
              }
              if (!ctx.path.startsWith(base)) {
                await next();
                return;
              }
              const events = `${base}__dirwell_events`;
              if (ctx.path === events) {
                ctx.respond = false;
                ctx.res.writeHead(200, {
                  "content-type": "text/event-stream",
                  "cache-control": "no-cache",
                });
                ctx.res.write(": connected\n\n");
                clients.add(ctx.res);
                ctx.req.on("close", () => clients.delete(ctx.res));
                return;
              }
              let relative: string;
              try {
                relative = decodeURIComponent(ctx.path.slice(base.length));
              } catch {
                ctx.status = 400;
                return;
              }
              if (relative.split("/").some((part) => part === "..") || relative.includes("\\")) {
                ctx.status = 403;
                return;
              }
              const file = `${prefix}/${relative.endsWith("/") || !relative ? `${relative}index.html` : relative}`;
              const contents = assets.get(file);
              if (contents === undefined) {
                ctx.status = 404;
                return;
              }
              ctx.type = path.extname(file) || "application/octet-stream";
              ctx.set("cache-control", "no-store");
              ctx.body = file.endsWith(".html")
                ? Buffer.from(contents)
                    .toString()
                    .replace(
                      "</body>",
                      `<script>new EventSource(${JSON.stringify(events)}).addEventListener('reload',()=>location.reload())</script></body>`,
                    )
                : contents;
            });
          const close = server.close.bind(server);
          server.close = async () => {
            closed = true;
            clearTimeout(timer);
            for (const client of clients) client.end();
            try {
              await ready;
              await sourceWatcher?.close();
              await pending;
              await server.watcher?.getInternalWatcher()?.close();
            } finally {
              sourceWatcher = undefined;
              await close();
            }
          };
        },
      },
      esbuild: {
        setup(build) {
          if (inline.cwd === undefined) cwd = build.initialOptions.absWorkingDir ?? cwd;
          const output =
            build.initialOptions.outdir ??
            (build.initialOptions.outfile === undefined
              ? undefined
              : path.dirname(build.initialOptions.outfile));
          if (output !== undefined) hostOutput = path.resolve(cwd, output);
          build.initialOptions.inject = [...(build.initialOptions.inject ?? []), virtual];
          build.onResolve({ filter: /^dirwell-watch:/ }, (args) =>
            args.path === virtual ? { path: virtual, namespace: virtual } : undefined,
          );
          build.onLoad({ filter: /.*/, namespace: virtual }, async () => {
            const watched = await paths();
            return {
              contents: "",
              loader: "js",
              watchFiles: watched.files,
              watchDirs: watched.directories,
            };
          });
          build.onStart(async () => {
            failed = false;
            await prepare();
          });
          build.onEnd(async (result) => {
            if (result.errors.length) return;
            const assets: { fileName: string; source: string | Uint8Array }[] = [];
            await emit({
              emitFile(asset) {
                if (asset.fileName && asset.source !== undefined)
                  assets.push({ fileName: asset.fileName, source: asset.source });
              },
            });
            for (const asset of assets) {
              const destination = path.join(hostOutput!, asset.fileName);
              if (build.initialOptions.write !== false) {
                await mkdir(path.dirname(destination), { recursive: true });
                await writeFile(destination, asset.source);
              } else {
                const bytes =
                  typeof asset.source === "string" ? Buffer.from(asset.source) : asset.source;
                result.outputFiles ??= [];
                result.outputFiles.push({
                  path: destination,
                  contents: bytes,
                  hash: "",
                  get text() {
                    return Buffer.from(bytes).toString();
                  },
                });
              }
            }
            if (build.initialOptions.write !== false) await removeStaleFiles();
          });
        },
      },
      bun: {
        setup(build) {
          if (build.config.outdir !== undefined)
            hostOutput = path.resolve(cwd, build.config.outdir);
          build.onEnd(async (result: { success: boolean }) => {
            failed = !result.success;
            if (!failed) {
              await emit(context);
              await removeStaleFiles();
            }
          });
        },
      },
    };
  });
});

/** The Vite host retains its server integration; all other hosts share asset generation. */
export const unplugin: Pick<
  UnpluginInstance<DirwellPluginInput, true>,
  "vite" | "rollup" | "rolldown" | "webpack" | "rspack" | "rsbuild" | "esbuild" | "farm" | "bun"
> = {
  vite: core.vite,
  rollup: core.rollup,
  rolldown: core.rolldown,
  webpack: core.webpack,
  rspack: core.rspack,
  rsbuild: core.rsbuild,
  esbuild: core.esbuild,
  farm: core.farm,
  bun: core.bun,
};
export default unplugin;
