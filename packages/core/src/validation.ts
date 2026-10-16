import type { GenerateOptions, ExplorerTheme } from "./model.ts";
import type { DirectoryServiceOptions } from "./service.ts";
import type { ListingPlan } from "./listing.ts";
import { resolveIgnoreFiles } from "./filters.ts";
import { resolveDirectoryUrls } from "./routing.ts";

type Options = Record<string, unknown>;
export function optionObject(value: unknown, name: string): Options {
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
export function optionKeys(value: Options, allowed: readonly string[], name: string): void {
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
function scalar(value: unknown, type: "boolean" | "string" | "function", name: string): void {
  if (value !== undefined && typeof value !== type)
    throw new TypeError(`${name} must be a ${type}`);
}
function choice(value: unknown, allowed: readonly unknown[], name: string): void {
  if (value !== undefined && !allowed.includes(value))
    throw new TypeError(`${name} must be one of ${allowed.join(", ")}`);
}
function positiveInteger(value: unknown, name: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new TypeError(`${name} must be a positive safe integer`);
}
export function validateListingPlan(value: unknown): asserts value is ListingPlan {
  const plan = optionObject(value, "listing");
  optionKeys(plan, ["html", "data"], "listing");
  for (const [key, strategy, size] of [
    ["html", "paged", "pageSize"],
    ["data", "blocks", "blockSize"],
  ] as const) {
    const section = optionObject(plan[key], `listing.${key}`);
    optionKeys(
      section,
      section.strategy === strategy ? ["strategy", size] : ["strategy"],
      `listing.${key}`,
    );
    if (section.strategy !== "all" && section.strategy !== strategy)
      throw new TypeError(`listing.${key}.strategy must be all or ${strategy}`);
    if (section.strategy === strategy) positiveInteger(section[size], `listing.${key}.${size}`);
  }
}
function selection(value: Options, name: string): void {
  for (const key of ["include", "exclude"])
    if (
      value[key] !== undefined &&
      typeof value[key] !== "string" &&
      (!Array.isArray(value[key]) || value[key].some((item: unknown) => typeof item !== "string"))
    )
      throw new TypeError(`${name}.${key} must be a string or array of strings`);
  resolveIgnoreFiles(value.ignoreFiles);
  scalar(value.entryData, "function", `${name}.entryData`);
  if (value.sort !== undefined) {
    const sort = optionObject(value.sort, `${name}.sort`);
    optionKeys(sort, ["field", "direction", "directoriesFirst", "nameMode"], `${name}.sort`);
    scalar(sort.directoriesFirst, "boolean", `${name}.sort.directoriesFirst`);
    choice(sort.field, ["name", "size", "targetSize", "modified"], `${name}.sort.field`);
    choice(sort.direction, ["asc", "desc"], `${name}.sort.direction`);
    choice(sort.nameMode, ["natural", "locale", "unicode"], `${name}.sort.nameMode`);
  }
}
function requiredString(value: unknown, name: string): void {
  if (typeof value !== "string" || !value.length)
    throw new TypeError(`${name} must be a non-empty string`);
}
export function validateTheme(
  value: unknown,
  name = "options.theme",
): asserts value is ExplorerTheme {
  if (value === undefined) throw new TypeError("Core requires an explicit theme");
  const theme = optionObject(value, name);
  requiredString(theme.name, `${name}.name`);
  if (typeof theme.render !== "function") throw new TypeError(`${name}.render must be a function`);
  scalar(theme.entryData, "function", `${name}.entryData`);
  scalar(theme.searchIndex, "boolean", `${name}.searchIndex`);
  if (theme.listing !== undefined) {
    const listing = optionObject(theme.listing, `${name}.listing`);
    optionKeys(listing, ["pagination"], `${name}.listing`);
    if (typeof listing.pagination !== "boolean")
      throw new TypeError(`${name}.listing.pagination must be a boolean`);
  }
}
const generateKeys = {
  routing: true,
  sourceDir: true,
  outputDir: true,
  theme: true,
  include: true,
  exclude: true,
  ignoreFiles: true,
  sort: true,
  entryData: true,
  fileHref: true,
  dryRun: true,
  outputPolicy: true,
  listing: true,
  metadata: true,
  base: true,
  mode: true,
  mirror: true,
  outputName: true,
  urlStrategy: true,
  symlinks: true,
} satisfies Record<keyof GenerateOptions, true>;
export function validateGenerateOptions(value: unknown): asserts value is GenerateOptions {
  const options = optionObject(value, "options");
  optionKeys(options, Object.keys(generateKeys), "options");
  resolveDirectoryUrls(options.routing, "options.routing");
  requiredString(options.sourceDir, "options.sourceDir");
  requiredString(options.outputDir, "options.outputDir");
  validateTheme(options.theme);
  selection(options, "options");
  for (const key of ["fileHref", "metadata"]) scalar(options[key], "function", `options.${key}`);
  for (const key of ["dryRun", "mirror"]) scalar(options[key], "boolean", `options.${key}`);
  scalar(options.base, "string", "options.base");
  choice(options.mode, ["ssg", "mpa"], "options.mode");
  choice(
    options.urlStrategy,
    Object.keys({
      base: true,
      "html-base": true,
      relative: true,
    } satisfies Record<NonNullable<GenerateOptions["urlStrategy"]>, true>),
    "options.urlStrategy",
  );
  choice(options.outputPolicy, ["owned", "replace"], "options.outputPolicy");
  if (
    options.outputName !== undefined &&
    typeof options.outputName !== "string" &&
    typeof options.outputName !== "function"
  )
    throw new TypeError("options.outputName must be a string or function");
  if (options.listing !== undefined && typeof options.listing !== "function")
    validateListingPlan(options.listing);
  if (options.symlinks !== undefined) {
    const links = optionObject(options.symlinks, "options.symlinks");
    optionKeys(links, ["follow", "boundary", "onCycle"], "options.symlinks");
    scalar(links.follow, "boolean", "options.symlinks.follow");
    choice(links.boundary, ["root", "anywhere"], "options.symlinks.boundary");
    choice(links.onCycle, ["error", "skip"], "options.symlinks.onCycle");
  }
}
const serviceKeys = {
  root: true,
  include: true,
  exclude: true,
  ignoreFiles: true,
  sort: true,
  entryData: true,
} satisfies Record<keyof DirectoryServiceOptions, true>;
export function validateDirectoryOptions(value: unknown): asserts value is DirectoryServiceOptions {
  const options = optionObject(value, "options");
  optionKeys(options, Object.keys(serviceKeys), "options");
  requiredString(options.root, "options.root");
  selection(options, "options");
}
