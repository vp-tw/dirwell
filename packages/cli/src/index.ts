import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolve as resolveModule } from "import-meta-resolve";
import { parseArgs } from "node:util";
import { generateExplorer } from "@dirwell/core";
import type { ExplorerTheme, ListingPolicy, GenerateOptions } from "@dirwell/core";
import { startExplorerServer } from "@dirwell/server/node";
import type { ExplorerHandlerOptions } from "@dirwell/server";

export interface CliConfig {
  readonly build?: Omit<GenerateOptions, "sourceDir" | "outputDir" | "theme" | "listing">;
  readonly theme?: ExplorerTheme;
  readonly listing?: ListingPolicy;
  readonly server?: Omit<ExplorerHandlerOptions, "root" | "theme" | "listing">;
}
const help = `Usage:
  dirwell build <source> --out <output> --theme <module>#<factory>
  dirwell server <source> --theme <module>#<factory> [--port 3000]

Install your theme separately. No theme is installed or selected implicitly.
Use --config <file.mjs> for a default export with theme, listing, and server hooks.
Build options: --mode ssg|mpa, --urls relative|base|html-base, --base <path>
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
async function loadTheme(specifier: string, cwd: string): Promise<ExplorerTheme> {
  const delimiter = specifier.lastIndexOf("#"),
    name = delimiter < 0 ? specifier : specifier.slice(0, delimiter),
    exported = delimiter < 0 ? "default" : specifier.slice(delimiter + 1);
  if (!name || !exported) throw new TypeError("Theme needs a module and export name");
  const moduleUrl =
    name.startsWith(".") || path.isAbsolute(name)
      ? pathToFileURL(path.resolve(cwd, name)).href
      : resolveModule(name, pathToFileURL(path.join(cwd, "package.json")).href);
  const module: Record<string, unknown> = await import(moduleUrl);
  const candidate =
    typeof module[exported] === "function" ? await module[exported]() : module[exported];
  if (
    typeof candidate !== "object" ||
    candidate === null ||
    !("name" in candidate) ||
    typeof candidate.name !== "string" ||
    !("render" in candidate) ||
    typeof candidate.render !== "function"
  )
    throw new TypeError("Theme export must be a theme or theme factory");
  return candidate as ExplorerTheme;
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
    parsed.positionals.length !== 2
  )
    throw new TypeError(help);
  let config: CliConfig = {};
  if (parsed.values.config) {
    const module = await import(pathToFileURL(path.resolve(cwd, parsed.values.config)).href);
    if (typeof module.default !== "object" || module.default === null)
      throw new TypeError("Config must export an object");
    config = module.default;
  }
  const theme = parsed.values.theme ? await loadTheme(parsed.values.theme, cwd) : config.theme;
  if (theme === undefined)
    throw new TypeError(
      "Choose an explicit --theme or config.theme. Install the theme package separately.",
    );
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
  if (command === "build") {
    if (parsed.values.out === undefined)
      throw new TypeError("Build requires --out pointing to a dedicated generated output tree");
    const mode = parsed.values.mode ?? config.build?.mode ?? "ssg",
      urlStrategy = parsed.values.urls ?? config.build?.urlStrategy ?? "relative";
    if (mode !== "ssg" && mode !== "mpa") throw new TypeError("mode must be ssg or mpa");
    if (!["relative", "base", "html-base"].includes(urlStrategy))
      throw new TypeError("Unknown URL strategy");
    await generateExplorer({
      ...config.build,
      sourceDir: root,
      outputDir: path.resolve(cwd, parsed.values.out),
      theme,
      mode,
      urlStrategy: urlStrategy as "relative" | "base" | "html-base",
      ...(parsed.values.base === undefined ? {} : { base: parsed.values.base }),
      ...(listing === undefined ? {} : { listing }),
    });
    log(`Built ${parsed.values.out}`);
    return null;
  }
  const port = Number(parsed.values.port ?? process.env.PORT ?? "0");
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535)
    throw new TypeError("port must be between 0 and 65535");
  const server = await startExplorerServer({
    ...config.server,
    ...(parsed.values.live ? { live: {} } : {}),
    root,
    theme,
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
