import path from "node:path";
import { access, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve as resolveModule } from "import-meta-resolve";
import { parseArgs } from "node:util";
import { generateExplorer, resolveIgnoreFiles } from "@dirwell/core";
import type { ExplorerTheme, ListingPolicy, GenerateOptions } from "@dirwell/core";
import { createPlainTheme } from "@dirwell/theme-plain";
import { startExplorerServer } from "@dirwell/server/node";
import { validateCliConfig } from "./config.ts";
export { defineConfig } from "./config.ts";

export interface CliConfig {
  readonly ignoreFiles?: GenerateOptions["ignoreFiles"];
  readonly build?: Omit<GenerateOptions, "sourceDir" | "outputDir" | "theme" | "listing">;
  readonly theme?: ExplorerTheme;
  readonly listing?: ListingPolicy;
  readonly server?: Omit<Parameters<typeof startExplorerServer>[0], "root" | "theme" | "listing">;
}
const help = `Usage:
  dirwell build <source> --out <output>
  dirwell server <source> [--port 3000]

Plain is included and selected by default. Install other themes separately.
Official themes: --theme plain|ledger|crosswave
Custom themes: --theme <module>#<factory>, or a module's default export.
Reads dirwell.config.mjs in the working folder; --config <file.mjs> selects another file.
Config exports theme, listing, build options, and server hooks.
Build options: --mode ssg|mpa, --urls relative|base|html-base, --base <path>
Build safety: --dry-run, --force (-f) replaces an unowned nonempty output.
Selection: --ignore-file <path> (repeatable), --no-ignore disables ignore files.
Server options: --host <host>, --port <port>, --mount <path>, --live
Both modes: --page-size <n>, --block-size <n>
Live server reads on request. It does not build an output tree or require watch mode.
`;
const positive = (value: string | undefined, name: string): number | undefined => {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1)
    throw new TypeError(`${name} must be a positive integer`);
  return number;
};
function assertTheme(candidate: unknown): asserts candidate is ExplorerTheme {
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("name" in candidate) ||
    typeof candidate.name !== "string" ||
    !("render" in candidate) ||
    typeof candidate.render !== "function"
  )
    throw new TypeError("Theme must be an object with name and render(context)");
}
async function loadTheme(specifier: string, cwd: string): Promise<ExplorerTheme> {
  const official: Record<string, string> = {
    plain: "@dirwell/theme-plain#createPlainTheme",
    ledger: "@dirwell/theme-ledger#createLedgerTheme",
    crosswave: "@dirwell/theme-crosswave#createCrosswaveTheme",
  };
  if (Object.hasOwn(official, specifier)) specifier = official[specifier]!;
  const delimiter = specifier.lastIndexOf("#"),
    name = delimiter < 0 ? specifier : specifier.slice(0, delimiter),
    exported = delimiter < 0 ? "default" : specifier.slice(delimiter + 1);
  if (!name || !exported) throw new TypeError("Theme needs a module and export name");
  let moduleUrl: string;
  if (name.startsWith(".") || path.isAbsolute(name)) {
    moduleUrl = pathToFileURL(path.resolve(cwd, name)).href;
  } else {
    try {
      moduleUrl = resolveModule(name, pathToFileURL(path.join(cwd, "package.json")).href);
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ERR_MODULE_NOT_FOUND"))
        throw error;
      // npm exec installs explicit --package entries beside the CLI, outside the user's folder.
      try {
        moduleUrl = resolveModule(name, import.meta.url);
      } catch (fallbackError) {
        if (
          fallbackError instanceof Error &&
          "code" in fallbackError &&
          fallbackError.code === "ERR_MODULE_NOT_FOUND"
        )
          throw new TypeError(
            `Theme package "${name}" was not found. Install it in your project or include it with npm exec --package=${name}.`,
          );
        throw fallbackError;
      }
    }
  }
  const module: Record<string, unknown> = await import(moduleUrl);
  const candidate =
    typeof module[exported] === "function" ? await module[exported]() : module[exported];
  assertTheme(candidate);
  return candidate;
}
/** Parse explicit commands; return server ownership to the caller for graceful shutdown. */
export async function runCli(
  args: readonly string[],
  cwd = process.cwd(),
  log: (value: string) => void = console.log,
) {
  const parsed = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      force: { type: "boolean", short: "f" },
      "dry-run": { type: "boolean" },
      "ignore-file": { type: "string", multiple: true },
      "no-ignore": { type: "boolean" },
      live: { type: "boolean" },
      theme: { type: "string" },
      config: { type: "string" },
      out: { type: "string" },
      mode: { type: "string" },
      urls: { type: "string" },
      base: { type: "string" },
      host: { type: "string" },
      port: { type: "string" },
      mount: { type: "string" },
      "page-size": { type: "string" },
      "block-size": { type: "string" },
    },
  });
  if (parsed.values.help) {
    log(help);
    return null;
  }
  const [command, source] = parsed.positionals;
  if (
    !["build", "server"].includes(command ?? "") ||
    source === undefined ||
    source === "" ||
    parsed.positionals.length !== 2
  )
    throw new TypeError(help);
  const otherModeOptions =
    command === "build"
      ? ["host", "port", "mount", "live"]
      : ["out", "mode", "urls", "base", "force", "dry-run"];
  for (const option of otherModeOptions)
    if (Object.hasOwn(parsed.values, option))
      throw new TypeError(`--${option} is not supported in ${command} mode`);
  let config: CliConfig = {};
  const configPath = path.resolve(cwd, parsed.values.config ?? "dirwell.config.mjs");
  let hasConfig = parsed.values.config !== undefined;
  if (!hasConfig) {
    try {
      await access(configPath);
      hasConfig = true;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    }
  }
  if (!hasConfig) {
    for (const filename of [
      "dirwell.config.ts",
      "dirwell.config.js",
      "dirwell.config.mts",
      "dirwell.config.cjs",
    ]) {
      try {
        await access(path.resolve(cwd, filename));
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
        throw error;
      }
      throw new TypeError(
        `Found ${filename}. This CLI discovers dirwell.config.mjs only. Migrate the config or select a native JavaScript module with --config; existing rules will not be silently ignored.`,
      );
    }
  }
  if (hasConfig) {
    const module = await import(pathToFileURL(configPath).href);
    if (
      typeof module.default !== "object" ||
      module.default === null ||
      Array.isArray(module.default)
    )
      throw new TypeError("Config must export an object");
    for (const key of Object.keys(module.default))
      if (!["theme", "listing", "build", "server", "ignoreFiles"].includes(key))
        throw new TypeError(
          `Unsupported config key "${key}". Use { theme, listing, build, server }; selection rules belong in build/server.`,
        );
    if (typeof module.default.then === "function")
      throw new TypeError(
        "Config must export a resolved object; use top-level await for async setup",
      );
    validateCliConfig(module.default);
    config = module.default;
  }
  const theme =
    parsed.values.theme !== undefined
      ? await loadTheme(parsed.values.theme, cwd)
      : config.theme === undefined
        ? createPlainTheme()
        : config.theme;
  assertTheme(theme);
  const pageSize = positive(parsed.values["page-size"], "page-size"),
    blockSize = positive(parsed.values["block-size"], "block-size");
  const listing: ListingPolicy | undefined =
    pageSize !== undefined || blockSize !== undefined
      ? {
          html: pageSize === undefined ? { strategy: "all" } : { strategy: "paged", pageSize },
          data: blockSize === undefined ? { strategy: "all" } : { strategy: "blocks", blockSize },
        }
      : config.listing;
  const root = path.resolve(cwd, source);
  if (!(await stat(root)).isDirectory())
    throw new TypeError("Source must be an existing directory");
  if (parsed.values["no-ignore"] && parsed.values["ignore-file"])
    throw new TypeError("--no-ignore cannot be combined with --ignore-file");
  const modeOptions = command === "build" ? config.build : config.server;
  const ignoreFiles = resolveIgnoreFiles(
    parsed.values["no-ignore"]
      ? []
      : (parsed.values["ignore-file"] ??
          modeOptions?.ignoreFiles ??
          config.ignoreFiles ?? [{ path: ".gitignore", optional: true }]),
    cwd,
  );
  if (command === "build") {
    if (parsed.values.out === undefined)
      throw new TypeError("Build requires --out pointing to a dedicated generated output tree");
    const mode = parsed.values.mode ?? config.build?.mode ?? "ssg",
      urlStrategy = parsed.values.urls ?? config.build?.urlStrategy ?? "relative";
    if (mode !== "ssg" && mode !== "mpa") throw new TypeError("mode must be ssg or mpa");
    if (!["relative", "base", "html-base"].includes(urlStrategy))
      throw new TypeError("Unknown URL strategy");
    const report = await generateExplorer({
      ...config.build,
      sourceDir: root,
      outputDir: path.resolve(cwd, parsed.values.out),
      theme,
      ignoreFiles,
      ...(parsed.values.force ? { outputPolicy: "replace" } : {}),
      ...(parsed.values["dry-run"] ? { dryRun: true } : {}),
      mode,
      urlStrategy: urlStrategy as "relative" | "base" | "html-base",
      ...(parsed.values.base === undefined ? {} : { base: parsed.values.base }),
      ...(listing === undefined ? {} : { listing }),
    });
    if (report.dryRun) log(JSON.stringify(report, null, 2));
    else {
      log(`Built ${parsed.values.out}`);
      log(
        `${report.selectedPaths.length} selected paths; ${report.pages.filter((page) => page.outputName !== null).length} directory pages; ${report.pages.filter((page) => page.outputName === null).length} skipped pages.`,
      );
      for (const page of report.pages)
        if (page.directory === "" || page.outputName === null)
          log(
            page.outputName === null
              ? `Skipped explorer page: ${page.directory || "/"}`
              : `Explorer entry: ${path.join(report.outputDir, page.outputName)}`,
          );
    }
    return null;
  }
  const port = Number(parsed.values.port ?? process.env.PORT ?? config.server?.port ?? 0);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535)
    throw new TypeError("port must be between 0 and 65535");
  const server = await startExplorerServer({
    ...config.server,
    ...(parsed.values.live ? { live: config.server?.live || {} } : {}),
    root,
    theme,
    ignoreFiles,
    port,
    ...(listing === undefined ? {} : { listing }),
    ...(pageSize === undefined ? {} : { pageSize }),
    ...(blockSize === undefined ? {} : { blockSize }),
    ...(parsed.values.host === undefined ? {} : { host: parsed.values.host }),
    ...(parsed.values.mount === undefined ? {} : { mountPath: parsed.values.mount }),
  });
  log(
    `Dirwell server: ${server.url}${parsed.values.mount ?? config.server?.mountPath ?? ""}/browse/`,
  );
  return server;
}
