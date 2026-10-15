import path from "node:path";

export type DirectoryUrls = "explicit" | "slash" | "clean";
export interface RoutingOptions {
  readonly directoryUrls?: DirectoryUrls;
}

/** Validate the shared policy before publication or server startup. */
export function resolveDirectoryUrls(value: unknown, name = "routing"): DirectoryUrls {
  if (value === undefined) return "explicit";
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError(`${name} must be an object`);
  for (const key of Object.keys(value))
    if (key !== "directoryUrls") throw new TypeError(`Unsupported option "${name}.${key}"`);
  const style = "directoryUrls" in value ? value.directoryUrls : undefined;
  if (style === undefined) return "explicit";
  if (style !== "explicit" && style !== "slash" && style !== "clean")
    throw new TypeError(`${name}.directoryUrls must be explicit, slash or clean`);
  return style;
}

export function encodeLogicalPath(value: string): string {
  return value.split("/").map(encodeURIComponent).join("/");
}

export interface DirectoryRoute {
  readonly outputPath: string;
  /** Unencoded archive-relative public pathname; the root is an empty string. */
  readonly publicPath: string;
}

/** Output placement and public URL are planned together, before theme rendering. */
export function directoryRoute(
  directory: string,
  filename: string,
  style: DirectoryUrls,
  page = 1,
): DirectoryRoute {
  if (style === "clean" && (filename === "index.html" || page > 1)) {
    const stem =
      page === 1
        ? directory
        : directory
          ? `${directory}.${filename.slice(0, -5)}`
          : filename.slice(0, -5);
    return { outputPath: stem ? `${stem}.html` : "index.html", publicPath: stem };
  }
  const outputPath = path.posix.join(directory, filename);
  return {
    outputPath,
    publicPath:
      style === "slash" && filename === "index.html"
        ? directory
          ? `${directory}/`
          : ""
        : outputPath,
  };
}

/** Resolve references from the public document, never from its logical directory. */
export function createHrefResolver(
  documentPath: string,
  strategy: "relative" | "base" | "html-base",
  base: string,
): (target: string) => string {
  const documentDirectory = documentPath.endsWith("/")
    ? documentPath
    : path.posix.dirname(documentPath || ".");
  return (target) => {
    const directory = target === "" || target.endsWith("/");
    if (strategy !== "relative") {
      const suffix = encodeLogicalPath(target);
      return strategy === "base" ? `${base}${suffix}` : suffix || "./";
    }
    const relative =
      path.posix.relative(documentDirectory || ".", target || ".") ||
      (directory ? "" : `../${path.posix.basename(target)}`);
    const encoded = relative
      .split("/")
      .map((segment) =>
        segment === ".." || segment === "." ? segment : encodeURIComponent(segment),
      )
      .join("/");
    return `${encoded || "."}${directory ? "/" : ""}`;
  };
}
