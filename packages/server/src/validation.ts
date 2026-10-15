import { validateListingPlan, resolveDirectoryUrls } from "@dirwell/core";
import type { ExplorerHandlerOptions } from "./index.ts";

type Options = Record<string, unknown>;
function object(value: unknown, name: string): Options {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError(`${name} must be an object`);
  return value as Options;
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
function keys(value: Options, allowed: readonly string[], name: string): void {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue;
    const suggestion = allowed
      .map((candidate) => ({ candidate, distance: distance(key, candidate) }))
      .sort((left, right) => left.distance - right.distance)
      .find((item) => item.distance <= 2)?.candidate;
    throw new TypeError(
      `Unsupported option "${name}.${key}".${suggestion ? ` Did you mean "${name}.${suggestion}"?` : ` Supported keys: ${allowed.join(", ")}.`}`,
    );
  }
}
function scalar(value: unknown, type: "string" | "function" | "boolean", name: string): void {
  if (value !== undefined && typeof value !== type)
    throw new TypeError(`${name} must be a ${type}`);
}
function integer(value: unknown, minimum: number, name: string): void {
  if (
    value !== undefined &&
    (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum)
  )
    throw new TypeError(`${name} must be a safe integer of at least ${minimum}`);
}
const handlerKeys = {
  routing: true,
  root: true,
  include: true,
  exclude: true,
  sort: true,
  ignoreFiles: true,
  entryData: true,
  live: true,
  search: true,
  theme: true,
  listing: true,
  blockSize: true,
  mountPath: true,
  files: true,
  pageSize: true,
  maxPageSize: true,
  fileHref: true,
  headers: true,
  authorize: true,
} satisfies Record<keyof ExplorerHandlerOptions, true>;
export function validateHandlerOptions(value: unknown, node = false): void {
  const options = object(value, "options");
  resolveDirectoryUrls(options.routing, "options.routing");
  keys(options, [...Object.keys(handlerKeys), ...(node ? ["host", "port"] : [])], "options");
  for (const key of ["entryData", "fileHref", "headers", "authorize"])
    scalar(options[key], "function", `options.${key}`);
  scalar(options.mountPath, "string", "options.mountPath");
  for (const key of ["blockSize", "pageSize", "maxPageSize"])
    integer(options[key], 1, `options.${key}`);
  if (
    options.files !== undefined &&
    options.files !== false &&
    !["media", "inline", "attachment"].some((mode) => mode === options.files)
  )
    throw new TypeError("options.files must be false, media, inline or attachment");
  if (options.listing !== undefined && typeof options.listing !== "function")
    validateListingPlan(options.listing);
  if (options.live !== undefined && options.live !== false) {
    const live = object(options.live, "options.live");
    keys(live, ["intervalMs", "maxClients"], "options.live");
    integer(live.intervalMs, 25, "options.live.intervalMs");
    integer(live.maxClients, 1, "options.live.maxClients");
  }
  if (options.search !== undefined && options.search !== false) {
    const search = object(options.search, "options.search");
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
      "options.search",
    );
    for (const key of ["maxEntries", "maxDirectories", "maxConcurrent", "maxResults", "timeoutMs"])
      integer(search[key], 1, `options.search.${key}`);
    integer(search.refreshIntervalMs, 1000, "options.search.refreshIntervalMs");
    if (typeof search.maxResults === "number" && search.maxResults > 10000)
      throw new TypeError("options.search.maxResults must not exceed 10000");
  }
  if (options.theme !== undefined) {
    const theme = object(options.theme, "options.theme");
    if (typeof theme.name !== "string" || !theme.name)
      throw new TypeError("options.theme.name must be a non-empty string");
    if (typeof theme.render !== "function")
      throw new TypeError("options.theme.render must be a function");
    scalar(theme.entryData, "function", "options.theme.entryData");
    scalar(theme.searchIndex, "boolean", "options.theme.searchIndex");
    if (theme.listing !== undefined) {
      const listing = object(theme.listing, "options.theme.listing");
      keys(listing, ["pagination"], "options.theme.listing");
      if (typeof listing.pagination !== "boolean")
        throw new TypeError("options.theme.listing.pagination must be a boolean");
    }
  }
  if (node) {
    scalar(options.host, "string", "options.host");
    if (options.host === "") throw new TypeError("options.host must be a non-empty string");
    integer(options.port, 0, "options.port");
    if (typeof options.port === "number" && options.port > 65535)
      throw new TypeError("options.port must not exceed 65535");
  }
}
export function validateBridge(value: unknown): void {
  const bridge = object(value, "bridge");
  keys(bridge, ["requestTarget"], "bridge");
  scalar(bridge.requestTarget, "function", "bridge.requestTarget");
}
