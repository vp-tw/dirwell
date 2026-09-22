import { loadConfig } from "c12";
import path from "node:path";
import type { ExplorerTheme, GenerateOptions, OutputNameResolver } from "./model.ts";

export interface DirwellConfig {
  readonly extends?: string | readonly string[];
  readonly mode?: "mpa" | "ssg";
  readonly mirror?: boolean;
  readonly outDir?: string;
  readonly outputName?: OutputNameResolver;
  readonly root?: string;
  readonly server?: {
    readonly host?: string;
    readonly port?: number;
  };
  readonly symlinks?: GenerateOptions["symlinks"];
  readonly theme?: ExplorerTheme;
}

export interface DirwellConfigContext {
  readonly command: "build" | "daemon" | "serve";
}

export type DirwellConfigInput =
  | DirwellConfig
  | ((context: DirwellConfigContext) => DirwellConfig | Promise<DirwellConfig>);

export function defineConfig<const T extends DirwellConfigInput>(config: T): T {
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

export function validateConfig(value: unknown): asserts value is DirwellConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Dirwell config must resolve to an object");
  }
  const config = value as Record<string, unknown>;
  assertOptionalString(config.root, "root");
  assertOptionalString(config.outDir, "outDir");
  if (
    config.extends !== undefined &&
    typeof config.extends !== "string" &&
    (!Array.isArray(config.extends) ||
      config.extends.some((entry) => typeof entry !== "string" || entry.length === 0))
  ) {
    throw new TypeError("extends must be a string or an array of non-empty strings");
  }
  assertOptionalBoolean(config.mirror, "mirror");
  if (config.mode !== undefined && config.mode !== "mpa" && config.mode !== "ssg") {
    throw new TypeError('mode must be either "ssg" or "mpa"');
  }
  if (config.outputName !== undefined && typeof config.outputName !== "function") {
    throw new TypeError("outputName must be a function");
  }
  if (config.theme !== undefined) {
    const theme = config.theme as Record<string, unknown>;
    if (typeof theme !== "object" || theme === null || typeof theme.render !== "function") {
      throw new TypeError("theme must implement render(context)");
    }
  }
  if (config.server !== undefined) {
    if (typeof config.server !== "object" || config.server === null) {
      throw new TypeError("server must be an object");
    }
    const server = config.server as Record<string, unknown>;
    assertOptionalString(server.host, "server.host");
    if (
      server.port !== undefined &&
      (typeof server.port !== "number" || !Number.isInteger(server.port) || server.port < 0)
    ) {
      throw new TypeError("server.port must be a non-negative integer");
    }
  }
}

export async function loadDirwellConfig(
  cwd: string,
  command: DirwellConfigContext["command"],
): Promise<{ config: DirwellConfig; configFile: string | null }> {
  const loaded = await loadConfig<DirwellConfig>({
    name: "dirwell",
    cwd,
    context: { command } satisfies DirwellConfigContext,
    defaults: {},
    rcFile: false,
    globalRc: false,
  });
  validateConfig(loaded.config);
  return {
    config: loaded.config,
    configFile: loaded._configFile ?? null,
  };
}

export function resolveGenerateOptions(
  cwd: string,
  config: DirwellConfig,
  overrides: Partial<Pick<DirwellConfig, "mode" | "outDir" | "root">> = {},
): GenerateOptions {
  const sourceDir = path.resolve(cwd, overrides.root ?? config.root ?? ".");
  const outputDir = path.resolve(cwd, overrides.outDir ?? config.outDir ?? "dist");
  return {
    sourceDir,
    outputDir,
    ...(overrides.mode === undefined && config.mode === undefined
      ? {}
      : { mode: overrides.mode ?? config.mode }),
    ...(config.mirror === undefined ? {} : { mirror: config.mirror }),
    ...(config.outputName === undefined ? {} : { outputName: config.outputName }),
    ...(config.symlinks === undefined ? {} : { symlinks: config.symlinks }),
    ...(config.theme === undefined ? {} : { theme: config.theme }),
  };
}
