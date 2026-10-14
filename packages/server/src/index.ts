import { validateHandlerOptions } from "./validation.ts";
import { fileResponse, type FileServingMode } from "./files.ts";
import { themeResponse } from "./html.ts";
import { createUpdatesHandler } from "./updates.ts";
import { createSearchHandler, type LiveSearchOptions } from "./search.ts";
import { resolveAuthorizedDirectory } from "./authorization.ts";
import { createHash } from "node:crypto";
import { createDirectoryService, DirectoryAccessError, projectListingEntry } from "@dirwell/core";
import type {
  DirectoryServiceOptions,
  FileSystemEntry,
  ExplorerTheme,
  ListingPolicy,
} from "@dirwell/core";

export interface ExplorerHandlerOptions extends DirectoryServiceOptions {
  readonly search?: false | LiveSearchOptions;
  /** Opt-in SSE revision notifications. No filesystem watcher is required. */
  readonly live?: false | { readonly intervalMs?: number; readonly maxClients?: number };
  /** HTML is opt-in and always requires an explicit theme. */
  readonly theme?: ExplorerTheme;
  readonly listing?: ListingPolicy;
  readonly blockSize?: number;
  readonly mountPath?: string;
  readonly files?: false | FileServingMode;
  readonly pageSize?: number;
  readonly maxPageSize?: number;
  /** File bytes belong to the host; omit this hook to publish null file hrefs. */
  readonly fileHref?: (logicalPath: string) => string | null;
  /** Headers customize successful authorized listing responses. No-store is the default. */
  readonly headers?: (request: Request) => HeadersInit | Promise<HeadersInit>;
  /** Request-level authorization; it does not redact child names inside an allowed listing. */
  readonly authorize?: (request: Request, directoryPath: string) => boolean | Promise<boolean>;
}
/** Live JSON listing endpoint. File transport is supplied by the host; no HTTP framework is installed. */
export async function createExplorerHandler(
  options: ExplorerHandlerOptions,
): Promise<(request: Request) => Promise<Response>> {
  validateHandlerOptions(options);
  const pageSize = options.pageSize ?? 100;
  const mount = options.mountPath ?? "";
  if (
    mount !== "" &&
    (!mount.startsWith("/") ||
      mount.endsWith("/") ||
      mount.includes("?") ||
      mount.includes("#") ||
      mount.includes("\\") ||
      mount
        .split("/")
        .slice(1)
        .some((segment) => segment === "" || segment === "." || segment === ".."))
  )
    throw new TypeError(
      "mountPath must be an absolute path without trailing slash or dot segments",
    );
  if (
    options.blockSize !== undefined &&
    (!Number.isSafeInteger(options.blockSize) || options.blockSize < 1)
  )
    throw new TypeError("Invalid block size");
  const maxPageSize = options.maxPageSize ?? 1000;
  if (
    !Number.isSafeInteger(pageSize) ||
    pageSize < 1 ||
    !Number.isSafeInteger(maxPageSize) ||
    maxPageSize < pageSize
  )
    throw new TypeError("Invalid server page sizes");
  if (
    options.files !== undefined &&
    options.files !== false &&
    !["media", "attachment", "inline"].includes(options.files)
  )
    throw new TypeError("Invalid file serving mode");
  const service = await createDirectoryService({
    root: options.root,
    ...(options.include === undefined ? {} : { include: options.include }),
    ...(options.exclude === undefined ? {} : { exclude: options.exclude }),
    ...(options.ignoreFiles === undefined ? {} : { ignoreFiles: options.ignoreFiles }),
    ...(options.sort === undefined ? {} : { sort: options.sort }),
    ...(options.entryData === undefined ? {} : { entryData: options.entryData }),
  });
  const headersFor = async (request: Request, headers: Headers) => {
    headers.set("cache-control", "no-store");
    if (options.headers !== undefined)
      new Headers(await options.headers(request)).forEach((value, key) => headers.set(key, value));
    if (options.authorize !== undefined) {
      const cache = headers.get("cache-control") ?? "no-store";
      if (/(?:^|,)\s*(?:public|s-maxage)\b/i.test(cache))
        throw new TypeError("Authorized responses cannot use a public cache policy");
      if (!/(?:^|,)\s*private\b/i.test(cache)) headers.set("cache-control", `private, ${cache}`);
    }
    return headers;
  };
  const targetFor = (entry: FileSystemEntry): string =>
    entry.symlink?.targetRelativePath ?? entry.relativePath;
  const updates = createUpdatesHandler(options, service, headersFor);
  const search = createSearchHandler(options, service, headersFor);
  return async (request) => {
    const url = new URL(request.url);
    if (mount && url.pathname !== mount && !url.pathname.startsWith(mount + "/"))
      return new Response("Not found", { status: 404 });
    const route = url.pathname.slice(mount.length) || "/";
    try {
      if (route === "/__dirwell/updates") return await updates(request);
      if (route === "/__dirwell/search") return await search(request);
      const response = await themeResponse(request, route, options, service, headersFor);
      if (response !== null) return response;
    } catch (error) {
      if (
        error instanceof DirectoryAccessError ||
        (error instanceof Error &&
          "code" in error &&
          ["ENOENT", "ENOTDIR", "EACCES", "ELOOP"].includes(String(error.code)))
      )
        return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      throw error;
    }
    const fileRoute =
      options.files !== undefined && options.files !== false && route.startsWith("/files/");
    if (route !== "/listing" && !fileRoute) return new Response("Not found", { status: 404 });
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    let directoryPath: string;
    try {
      directoryPath = fileRoute
        ? decodeURIComponent(route.slice("/files/".length))
        : (url.searchParams.get("path") ?? "");
    } catch {
      return new Response("Invalid encoding", { status: 400 });
    }
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const limit = Number(url.searchParams.get("limit") ?? pageSize);
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > maxPageSize
    )
      return new Response("Invalid pagination", {
        status: 400,
        headers: { "cache-control": "no-store" },
      });
    if (
      fileRoute &&
      options.authorize !== undefined &&
      (await options.authorize(request, directoryPath)) !== true
    )
      return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
    try {
      if (fileRoute && options.files)
        return await fileResponse(
          request,
          directoryPath,
          service,
          options.files,
          (headers) => headersFor(request, headers),
          async (target) =>
            options.authorize === undefined || (await options.authorize(request, target)) === true,
        );
      const resolved = await resolveAuthorizedDirectory(
        request,
        directoryPath,
        service,
        options.authorize,
      );
      if ("response" in resolved) return resolved.response;
      directoryPath = resolved.path;
      const directory = await service.listDirectory(directoryPath);
      const entries = directory.entries.map((entry) =>
        projectListingEntry(entry, {
          hrefFor(entry) {
            const link = entry.symlink;
            if (link && (link.isBroken || link.isOutsideRoot || link.isTargetExcluded))
              return options.files
                ? `${mount}/files/${entry.relativePath.split("/").map(encodeURIComponent).join("/")}`
                : null;
            const target = targetFor(entry);
            return entry.kind === "directory" || link?.targetKind === "directory"
              ? `${mount}/listing?path=${encodeURIComponent(target)}`
              : (options.fileHref?.(target) ??
                  (options.files
                    ? `${mount}/files/${target.split("/").map(encodeURIComponent).join("/")}`
                    : null));
          },
          exitsExplorerFor(entry) {
            const link = entry.symlink;
            return (
              Boolean(link && (link.isBroken || link.isOutsideRoot || link.isTargetExcluded)) ||
              (entry.kind !== "directory" && link?.targetKind !== "directory")
            );
          },
        }),
      );
      const revision = createHash("sha256")
        .update(JSON.stringify({ directory: directoryPath, sort: options.sort, entries }))
        .digest("hex");
      const body = JSON.stringify({
        version: 1,
        revision,
        directory: directoryPath,
        offset,
        total: entries.length,
        entries: entries.slice(offset, offset + limit),
      });
      const etag = `"${createHash("sha256").update(body).digest("hex")}"`;
      const headers = new Headers({
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        etag,
      });
      await headersFor(request, headers);
      // Weak comparison is correct for GET/HEAD; authorization was checked before validators.
      const matches = request.headers
        .get("if-none-match")
        ?.split(",")
        .some(
          (value) =>
            value.trim() === "*" ||
            value.trim().replace(/^W\//, "") === headers.get("etag")?.replace(/^W\//, ""),
        );
      if (matches) return new Response(null, { status: 304, headers });
      return new Response(request.method === "HEAD" ? null : body, { headers });
    } catch (error) {
      if (
        error instanceof DirectoryAccessError ||
        (error instanceof Error &&
          "code" in error &&
          ["ENOENT", "ENOTDIR", "EACCES", "ELOOP"].includes(String(error.code)))
      )
        return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      throw error;
    }
  };
}

export type { FileServingMode };
export type { LiveSearchOptions };
