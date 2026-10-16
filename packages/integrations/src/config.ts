import { validateListingPlan, resolveIgnoreFiles, resolveDirectoryUrls } from "@dirwell/core";
import path from "node:path";
import type { ExplorerTheme, GenerateOptions, SortOptions } from "@dirwell/core";
import { normalizePathPatterns } from "../../core/src/filters.ts";

export interface DirwellConfig {
  readonly routing?: GenerateOptions["routing"];
  readonly fileHref?: GenerateOptions["fileHref"];
  readonly entryData?: GenerateOptions["entryData"];
  readonly listing?: GenerateOptions["listing"];
  readonly metadata?: GenerateOptions["metadata"];
  readonly base?: string;
  readonly include?: GenerateOptions["include"];
  readonly exclude?: GenerateOptions["exclude"];
  readonly ignoreFiles?: GenerateOptions["ignoreFiles"];
  readonly extends?: string | readonly string[];
  readonly mode?: "mpa" | "ssg";
  readonly mirror?: boolean;
  readonly outDir?: string;
  readonly outputName?: GenerateOptions["outputName"];
  readonly root?: string;
  readonly server?: {
    readonly host?: string;
    readonly port?: number;
  };
  readonly symlinks?: GenerateOptions["symlinks"];
  readonly sort?: SortOptions;
  readonly theme: ExplorerTheme;
  readonly urls?: "base" | "html-base" | "relative";
}

export interface DirwellConfigContext {
  readonly command: "build" | "daemon" | "serve";
}

export type DirwellConfigInput =
  | DirwellConfig
  | ((context: DirwellConfigContext) => DirwellConfig | Promise<DirwellConfig>);

export function defineConfig<const T extends DirwellConfigInput>(config: T): T {
  if (typeof config !== "function") validateConfig(config);
  return config;
}

function assertOptionalBoolean(value: unknown, key: string): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== "boolean") {
    throw new TypeError(`${key} must be a boolean`);
  }
}

function assertOptionalString(value: unknown, key: string): asserts value is string | undefined {
  if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
    throw new TypeError(`${key} must be a non-empty string`);
  }
}

function configKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  name: string,
): void {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    const suggestion = allowed
      .map((candidate) => {
        let previous = Array.from({ length: candidate.length + 1 }, (_, index) => index);
        for (let i = 1; i <= key.length; i++) {
          const current = [i];
          for (let j = 1; j <= candidate.length; j++)
            current[j] = Math.min(
              current[j - 1]! + 1,
              previous[j]! + 1,
              previous[j - 1]! + (key[i - 1] === candidate[j - 1] ? 0 : 1),
            );
          previous = current;
        }
        return { candidate, distance: previous[candidate.length]! };
      })
      .sort((left, right) => left.distance - right.distance)
      .find((item) => item.distance <= 2)?.candidate;
    throw new TypeError(
      `Unsupported config key "${name}.${key}".${suggestion ? ` Did you mean "${name}.${suggestion}"?` : ` Supported keys: ${allowed.join(", ")}.`}`,
    );
  }
}
const configFields = {
  routing: true,
  fileHref: true,
  entryData: true,
  listing: true,
  metadata: true,
  base: true,
  include: true,
  exclude: true,
  ignoreFiles: true,
  extends: true,
  mode: true,
  mirror: true,
  outDir: true,
  outputName: true,
  root: true,
  server: true,
  symlinks: true,
  sort: true,
  theme: true,
  urls: true,
} satisfies Record<keyof DirwellConfig, true>;

export function validateConfig(
  value: unknown,
  adapter = false,
): asserts value is DirwellConfig & { readonly cwd?: string; readonly outputPath?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Dirwell config must resolve to an object");
  }
  const config = value as Record<string, unknown>;
  configKeys(
    config,
    [...Object.keys(configFields), ...(adapter ? ["cwd", "outputPath"] : [])],
    "config",
  );
  resolveDirectoryUrls(config.routing);
  if (adapter) {
    assertOptionalString(config.cwd, "config.cwd");
    assertOptionalString(config.outputPath, "config.outputPath");
    if (config.server !== undefined)
      throw new TypeError(
        "config.server is not a build-adapter option; configure the host explicitly",
      );
  }
  if (config.listing !== undefined && typeof config.listing !== "function")
    validateListingPlan(config.listing);
  if (config.metadata !== undefined && typeof config.metadata !== "function")
    throw new TypeError("metadata must be a core MetadataProviderFactory");
  if (config.theme === undefined) throw new TypeError("An explicit theme is required");
  assertOptionalString(config.root, "root");
  assertOptionalString(config.outDir, "outDir");
  assertOptionalString(config.base, "base");
  normalizePathPatterns(config.include, "include");
  normalizePathPatterns(config.exclude, "exclude");
  if (config.fileHref !== undefined && typeof config.fileHref !== "function")
    throw new TypeError("fileHref must be a function");
  if (config.entryData !== undefined && typeof config.entryData !== "function")
    throw new TypeError("entryData must be a function");
  resolveIgnoreFiles(config.ignoreFiles);
  if (config.extends !== undefined)
    throw new TypeError("Legacy config extends is unsupported; configure the host explicitly");
  assertOptionalBoolean(config.mirror, "mirror");
  if (config.mode !== undefined && config.mode !== "mpa" && config.mode !== "ssg") {
    throw new TypeError('mode must be either "ssg" or "mpa"');
  }
  if (
    config.urls !== undefined &&
    config.urls !== "relative" &&
    config.urls !== "base" &&
    config.urls !== "html-base"
  ) {
    throw new TypeError('urls must be "relative", "base", or "html-base"');
  }
  if (
    config.outputName !== undefined &&
    typeof config.outputName !== "function" &&
    (typeof config.outputName !== "string" || config.outputName.length === 0)
  ) {
    throw new TypeError("outputName must be a non-empty string or function");
  }
  if (config.theme !== undefined) {
    const theme = config.theme as Record<string, unknown>;
    if (typeof theme !== "object" || theme === null || typeof theme.render !== "function") {
      throw new TypeError("theme must implement render(context)");
    }
  }
  if (config.server !== undefined) {
    if (
      typeof config.server !== "object" ||
      config.server === null ||
      Array.isArray(config.server)
    ) {
      throw new TypeError("server must be an object");
    }
    const server = config.server as Record<string, unknown>;
    configKeys(server, ["host", "port"], "config.server");
    assertOptionalString(server.host, "server.host");
    if (
      server.port !== undefined &&
      (typeof server.port !== "number" || !Number.isInteger(server.port) || server.port < 0)
    ) {
      throw new TypeError("server.port must be a non-negative integer");
    }
  }
  if (config.symlinks !== undefined) {
    if (
      typeof config.symlinks !== "object" ||
      config.symlinks === null ||
      Array.isArray(config.symlinks)
    )
      throw new TypeError("config.symlinks must be an object");
    const links = config.symlinks as Record<string, unknown>;
    configKeys(links, ["follow", "boundary", "onCycle"], "config.symlinks");
    assertOptionalBoolean(links.follow, "config.symlinks.follow");
    if (links.boundary !== undefined && links.boundary !== "root" && links.boundary !== "anywhere")
      throw new TypeError("config.symlinks.boundary must be root or anywhere");
    if (links.onCycle !== undefined && links.onCycle !== "error" && links.onCycle !== "skip")
      throw new TypeError("config.symlinks.onCycle must be error or skip");
  }
  if (config.sort !== undefined) {
    if (typeof config.sort !== "object" || config.sort === null || Array.isArray(config.sort)) {
      throw new TypeError("sort must be an object");
    }
    const sort = config.sort as Record<string, unknown>;
    configKeys(sort, ["field", "direction", "directoriesFirst", "nameMode"], "config.sort");
    if (
      sort.field !== undefined &&
      (typeof sort.field !== "string" ||
        !["name", "modified", "size", "targetSize"].includes(sort.field))
    ) {
      throw new TypeError('sort.field must be "name", "modified", "size", or "targetSize"');
    }
    if (
      sort.nameMode !== undefined &&
      (typeof sort.nameMode !== "string" ||
        !["unicode", "locale", "natural"].includes(sort.nameMode))
    ) {
      throw new TypeError('sort.nameMode must be "unicode", "locale", or "natural"');
    }
    if (sort.direction !== undefined && sort.direction !== "asc" && sort.direction !== "desc") {
      throw new TypeError('sort.direction must be "asc" or "desc"');
    }
    assertOptionalBoolean(sort.directoriesFirst, "sort.directoriesFirst");
  }
}

export function resolveGenerateOptions(
  cwd: string,
  config: DirwellConfig,
  overrides: Partial<Pick<DirwellConfig, "base" | "mode" | "outDir" | "root" | "urls">> = {},
): GenerateOptions {
  const sourceDir = path.resolve(cwd, overrides.root ?? config.root ?? ".");
  const outputDir = path.resolve(cwd, overrides.outDir ?? config.outDir ?? "dist");
  return {
    sourceDir,
    outputDir,
    theme: config.theme,
    ...(config.routing === undefined ? {} : { routing: config.routing }),
    ...(config.fileHref === undefined ? {} : { fileHref: config.fileHref }),
    ...(config.entryData === undefined ? {} : { entryData: config.entryData }),
    ...(config.listing === undefined ? {} : { listing: config.listing }),
    ...(config.metadata === undefined ? {} : { metadata: config.metadata }),
    ...(overrides.base === undefined && config.base === undefined
      ? {}
      : { base: overrides.base ?? config.base }),
    ...(overrides.mode === undefined && config.mode === undefined
      ? {}
      : { mode: overrides.mode ?? config.mode }),
    ...(config.mirror === undefined ? {} : { mirror: config.mirror }),
    ...(config.include === undefined ? {} : { include: config.include }),
    ...(config.exclude === undefined ? {} : { exclude: config.exclude }),
    ...(config.ignoreFiles === undefined
      ? {}
      : { ignoreFiles: resolveIgnoreFiles(config.ignoreFiles, cwd) }),
    ...(config.outputName === undefined ? {} : { outputName: config.outputName }),
    ...(config.symlinks === undefined ? {} : { symlinks: config.symlinks }),
    ...(config.sort === undefined ? {} : { sort: config.sort }),
    ...(overrides.urls === undefined && config.urls === undefined
      ? {}
      : { urlStrategy: overrides.urls ?? config.urls }),
  };
}
