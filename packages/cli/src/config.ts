import type { CliConfig } from "./index.ts";
import { resolveIgnoreFiles, resolveDirectoryUrls } from "@dirwell/core";

type RecordValue = Record<string, unknown>;
function object(value: unknown, name: string): RecordValue {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError(`${name} must be an object`);
  return value as RecordValue;
}
function distance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const current = [i];
    for (let j = 1; j <= right.length; j++)
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[right.length]!;
}
function keys(value: RecordValue, allowed: readonly string[], name: string): void {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    const suggestion = allowed
      .map((candidate) => ({ candidate, distance: distance(key, candidate) }))
      .sort((left, right) => left.distance - right.distance)
      .find((item) => item.distance <= 2)?.candidate;
    throw new TypeError(
      `Unsupported config key "${name}.${key}".${suggestion ? ` Did you mean "${name}.${suggestion}"?` : ` Supported keys: ${allowed.join(", ")}.`}`,
    );
  }
}
function scalar(value: unknown, type: "string" | "boolean" | "number" | "function", name: string) {
  if (
    value !== undefined &&
    (typeof value !== type || (type === "number" && !Number.isFinite(value)))
  )
    throw new TypeError(`${name} must be a ${type}`);
}
function patterns(value: unknown, name: string): void {
  if (
    value !== undefined &&
    typeof value !== "string" &&
    (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
  )
    throw new TypeError(`${name} must be a string or an array of strings`);
}
function sort(value: unknown, name: string): void {
  if (value === undefined) return;
  const options = object(value, name);
  keys(options, ["direction", "directoriesFirst", "field", "nameMode"], name);
  scalar(options.directoriesFirst, "boolean", `${name}.directoriesFirst`);
  for (const [key, allowed] of Object.entries({
    direction: ["asc", "desc"],
    field: ["name", "size", "modified"],
    nameMode: ["natural", "unicode", "locale"],
  }))
    if (options[key] !== undefined && !allowed.includes(String(options[key])))
      throw new TypeError(`${name}.${key} must be one of ${allowed.join(", ")}`);
}
function listing(value: unknown, name: string): void {
  if (value === undefined || typeof value === "function") return;
  const plan = object(value, name);
  keys(plan, ["html", "data"], name);
  for (const [key, sizedStrategy, sizeKey] of [
    ["html", "paged", "pageSize"],
    ["data", "blocks", "blockSize"],
  ] as const) {
    const strategy = object(plan[key], `${name}.${key}`);
    keys(
      strategy,
      strategy.strategy === sizedStrategy ? ["strategy", sizeKey] : ["strategy"],
      `${name}.${key}`,
    );
    if (strategy.strategy !== "all" && strategy.strategy !== sizedStrategy)
      throw new TypeError(`${name}.${key}.strategy must be all or ${sizedStrategy}`);
    if (
      strategy.strategy === sizedStrategy &&
      (!Number.isSafeInteger(strategy[sizeKey]) || Number(strategy[sizeKey]) < 1)
    )
      throw new TypeError(`${name}.${key}.${sizeKey} must be a positive integer`);
  }
}
const buildKeys = {
  fileHref: true,
  entryData: true,
  dryRun: true,
  outputPolicy: true,
  ignoreFiles: true,
  metadata: true,
  base: true,
  include: true,
  exclude: true,
  mode: true,
  mirror: true,
  outputName: true,
  urlStrategy: true,
  symlinks: true,
  sort: true,
} satisfies Record<keyof NonNullable<CliConfig["build"]>, true>;
const serverKeys = {
  entryData: true,
  ignoreFiles: true,
  live: true,
  search: true,
  blockSize: true,
  mountPath: true,
  files: true,
  pageSize: true,
  maxPageSize: true,
  fileHref: true,
  headers: true,
  authorize: true,
  include: true,
  exclude: true,
  sort: true,
  host: true,
  port: true,
} satisfies Record<keyof NonNullable<CliConfig["server"]>, true>;

/** Validate both modes before filesystem publication or server startup. */
export function validateCliConfig(value: unknown): asserts value is CliConfig {
  const config = object(value, "Config");
  // Preserve the top-level diagnostic used by CLI consumers.
  for (const key of Object.keys(config))
    if (!["theme", "listing", "build", "server", "ignoreFiles", "routing"].includes(key))
      throw new TypeError(
        `Unsupported config key "${key}". Use { theme, routing, listing, build, server }; selection rules belong in build/server.`,
      );
  resolveDirectoryUrls(config.routing);
  listing(config.listing, "listing");
  resolveIgnoreFiles(config.ignoreFiles as CliConfig["ignoreFiles"]);
  for (const mode of ["build", "server"] as const) {
    if (config[mode] === undefined) continue;
    const options = object(config[mode], mode);
    keys(options, Object.keys(mode === "build" ? buildKeys : serverKeys), mode);
    patterns(options.include, `${mode}.include`);
    patterns(options.exclude, `${mode}.exclude`);
    resolveIgnoreFiles(options.ignoreFiles as CliConfig["ignoreFiles"]);
    sort(options.sort, `${mode}.sort`);
    scalar(options.entryData, "function", `${mode}.entryData`);
    if (mode === "build") {
      scalar(options.fileHref, "function", "build.fileHref");
      for (const key of ["base", "mode", "urlStrategy"])
        scalar(options[key], "string", `${mode}.${key}`);
      scalar(options.mirror, "boolean", "build.mirror");
      scalar(options.dryRun, "boolean", "build.dryRun");
      if (
        options.outputPolicy !== undefined &&
        options.outputPolicy !== "owned" &&
        options.outputPolicy !== "replace"
      )
        throw new TypeError("build.outputPolicy must be owned or replace");
      scalar(options.metadata, "function", "build.metadata");
      if (
        options.outputName !== undefined &&
        typeof options.outputName !== "string" &&
        typeof options.outputName !== "function"
      )
        throw new TypeError("build.outputName must be a string or function");
      if (options.symlinks !== undefined) {
        const links = object(options.symlinks, "build.symlinks");
        keys(links, ["follow", "boundary", "onCycle"], "build.symlinks");
        scalar(links.follow, "boolean", "build.symlinks.follow");
        for (const [key, allowed] of Object.entries({
          boundary: ["root", "anywhere"],
          onCycle: ["error", "skip"],
        }))
          if (links[key] !== undefined && !allowed.includes(String(links[key])))
            throw new TypeError(`build.symlinks.${key} must be one of ${allowed.join(", ")}`);
      }
    } else {
      for (const key of ["host", "mountPath"]) scalar(options[key], "string", `server.${key}`);
      for (const key of ["port", "pageSize", "maxPageSize", "blockSize"])
        scalar(options[key], "number", `server.${key}`);
      for (const key of ["fileHref", "headers", "authorize"])
        scalar(options[key], "function", `server.${key}`);
      if (
        options.files !== undefined &&
        options.files !== false &&
        !["media", "attachment", "inline"].includes(String(options.files))
      )
        throw new TypeError("server.files must be false, media, attachment or inline");
      if (options.live !== undefined && options.live !== false) {
        const live = object(options.live, "server.live");
        keys(live, ["intervalMs", "maxClients"], "server.live");
        for (const key of ["intervalMs", "maxClients"])
          scalar(live[key], "number", `server.live.${key}`);
      }
      if (options.search !== undefined && options.search !== false) {
        const search = object(options.search, "server.search");
        keys(
          search,
          [
            "maxEntries",
            "maxDirectories",
            "maxConcurrent",
            "maxResults",
            "timeoutMs",
            "refreshIntervalMs",
          ],
          "server.search",
        );
        if (typeof search.maxResults === "number" && search.maxResults > 10000)
          throw new TypeError("server.search.maxResults must not exceed 10000");
        for (const key of Object.keys(search)) {
          scalar(search[key], "number", `server.search.${key}`);
          if (
            !Number.isSafeInteger(search[key]) ||
            Number(search[key]) < (key === "refreshIntervalMs" ? 1000 : 1)
          )
            throw new TypeError(`server.search.${key} must be a positive safe integer`);
        }
      }
    }
  }
}

/** Preserve literal types and validate JavaScript configuration at definition time. */
export function defineConfig<const T extends CliConfig>(config: T): T {
  validateCliConfig(config);
  return config;
}
