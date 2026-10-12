import path from "node:path";
import { createHash } from "node:crypto";
import {
  projectListingEntry,
  copyJsonObject,
  listingRevision,
  validateListingPlan,
} from "@dirwell/core";
import type {
  DirectoryService,
  ThemeContext,
  ListingEntry,
  ListingManifest,
  ListingPlan,
  FileSystemEntry,
} from "@dirwell/core";
import type { ExplorerHandlerOptions } from "./index.ts";
import { resolveAuthorizedDirectory } from "./authorization.ts";

const encodePath = (value: string) => value.split("/").map(encodeURIComponent).join("/");
export async function themeResponse(
  request: Request,
  route: string,
  options: ExplorerHandlerOptions,
  service: DirectoryService,
  headersFor: (request: Request, headers: Headers) => Promise<Headers>,
): Promise<Response | null> {
  const theme = options.theme;
  if (theme === undefined) return null;
  const url = new URL(request.url),
    mount = options.mountPath ?? "";
  const browse = route === "/" || route.startsWith("/browse/");
  const virtual = [
    "/__dirwell/page",
    "/__dirwell/asset",
    "/__dirwell/listing/manifest",
    "/__dirwell/listing/block",
  ].includes(route);
  if (!browse && !virtual) return null;
  if (request.method !== "GET" && request.method !== "HEAD")
    return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  let logicalPath: string;
  try {
    logicalPath = browse
      ? decodeURIComponent(route.slice("/browse/".length).replace(/\/$/, ""))
      : (url.searchParams.get("path") ?? "");
  } catch {
    return new Response("Invalid encoding", { status: 400 });
  }
  if (route === "/") logicalPath = "";
  if (browse && !route.endsWith("/") && logicalPath.endsWith("/index.html"))
    logicalPath = logicalPath.slice(0, -"/index.html".length);
  else if (browse && !route.endsWith("/") && logicalPath === "index.html") logicalPath = "";
  if (
    route === "/" &&
    options.authorize &&
    (await options.authorize(request, logicalPath)) !== true
  )
    return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  if (route === "/")
    return new Response(null, {
      status: 307,
      headers: { location: mount + "/browse/", "cache-control": "no-store" },
    });
  const resolved = await resolveAuthorizedDirectory(
    request,
    logicalPath,
    service,
    options.authorize,
  );
  if ("response" in resolved) return resolved.response;
  logicalPath = resolved.path;
  const directory = await service.listDirectory(logicalPath);
  const hrefForDirectory = (logical: string) =>
    `${mount}/browse/${encodePath(logical)}${logical ? "/" : ""}`;
  const virtualHref = (name: string, parameters: Record<string, string>) =>
    `${mount}/__dirwell/${name}?${new URLSearchParams(parameters)}`;
  const fileHref = (logical: string) =>
    options.fileHref?.(logical) ?? (options.files ? `${mount}/files/${encodePath(logical)}` : null);
  const hrefFor = (entry: FileSystemEntry) => {
    const link = entry.symlink;
    if (link && (link.isBroken || link.isOutsideRoot || link.isTargetExcluded))
      return fileHref(entry.relativePath);
    const target = link?.targetRelativePath ?? entry.relativePath;
    return entry.kind === "directory" || link?.targetKind === "directory"
      ? hrefForDirectory(target)
      : fileHref(target);
  };
  const sort = {
    direction: "asc",
    directoriesFirst: true,
    field: "name",
    nameMode: "natural",
    ...options.sort,
  } as const;
  const baseContext: ThemeContext = {
    operation: "server",
    ...(options.live ? { updatesHref: virtualHref("updates", { path: logicalPath }) } : {}),
    directory,
    sort,
    mode: "ssg",
    outputName: "index.html",
    documentBaseHref: null,
    searchIndexHref: "",
    hrefForDirectory,
    hrefFor,
    hasPageForDirectory: () => true,
    exitsExplorerFor: (entry) =>
      Boolean(
        entry.symlink &&
        (entry.symlink.isBroken || entry.symlink.isOutsideRoot || entry.symlink.isTargetExcluded),
      ) ||
      (entry.kind !== "directory" && entry.symlink?.targetKind !== "directory"),
    assetHref: (name) => virtualHref("asset", { path: logicalPath, name }),
    pageDataHref: (_theme, directoryPath, page) =>
      virtualHref("page", { path: directoryPath, page: String(page) }),
  };
  const records: readonly ListingEntry[] = directory.entries.map((entry) => {
    const value = projectListingEntry(entry, baseContext);
    return theme.entryData
      ? {
          ...value,
          presentation: copyJsonObject(
            theme.entryData(value, {
              mode: baseContext.mode,
              outputName: baseContext.outputName,
              assetHref: baseContext.assetHref,
              hrefForDirectory,
              documentBaseHref: null,
              directoryPath: logicalPath,
              pageDataHref: baseContext.pageDataHref!,
            }),
          ),
        }
      : value;
  });
  const defaultPlan: ListingPlan = {
    html: theme.listing?.pagination
      ? { strategy: "paged", pageSize: options.pageSize ?? 100 }
      : { strategy: "all" },
    data: { strategy: "blocks", blockSize: options.blockSize ?? 200 },
  };
  const plan =
    typeof options.listing === "function"
      ? options.listing({
          directoryPath: logicalPath,
          visibleCount: records.length,
          dataBytes: Buffer.byteLength(JSON.stringify(records)),
          mode: "ssg",
          operation: "server",
          supportsPagination: theme.listing?.pagination === true,
        })
      : (options.listing ?? defaultPlan);
  validateListingPlan(plan);
  if (plan.html.strategy === "paged" && theme.listing?.pagination !== true)
    throw new TypeError("Theme does not support live pagination");
  const pageSize =
    plan.html.strategy === "paged" ? plan.html.pageSize : Math.max(1, records.length);
  const blockSize =
    plan.data.strategy === "blocks" ? plan.data.blockSize : Math.max(1, records.length);
  const revision = listingRevision(records, sort, hrefForDirectory(logicalPath), blockSize);
  const respond = async (body: string | Uint8Array, type: string) => {
    const headers = await headersFor(
      request,
      new Headers({
        "content-type": type,
        "x-content-type-options": "nosniff",
        etag: `"${createHash("sha256").update(body).digest("hex")}"`,
      }),
    );
    const matched = request.headers
      .get("if-none-match")
      ?.split(",")
      .some(
        (value) =>
          value.trim() === "*" ||
          value.trim().replace(/^W\//, "") === headers.get("etag")?.replace(/^W\//, ""),
      );
    return new Response(
      matched || request.method === "HEAD"
        ? null
        : typeof body === "string"
          ? body
          : new Uint8Array(body),
      { status: matched ? 304 : 200, headers },
    );
  };
  if (route === "/__dirwell/listing/manifest") {
    const blocks: ListingManifest["blocks"][number][] = [];
    for (let offset = 0; offset < records.length || offset === 0; offset += blockSize)
      blocks.push({
        href: virtualHref("listing/block", { path: logicalPath, revision, offset: String(offset) }),
        offset,
        count: Math.min(blockSize, Math.max(0, records.length - offset)),
      });
    return respond(
      JSON.stringify({
        version: 1,
        revision,
        directory: logicalPath,
        hrefBase: hrefForDirectory(logicalPath),
        total: records.length,
        sort,
        blocks,
      }),
      "application/json; charset=utf-8",
    );
  }
  if (route === "/__dirwell/listing/block") {
    if (url.searchParams.get("revision") !== revision)
      return new Response("Snapshot changed", {
        status: 410,
        headers: { "cache-control": "no-store" },
      });
    const offset = Number(url.searchParams.get("offset"));
    if (
      !url.searchParams.has("offset") ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      offset % blockSize !== 0 ||
      offset >= Math.max(1, records.length)
    )
      return new Response("Invalid block", { status: 400 });
    return respond(
      JSON.stringify({
        version: 1,
        revision,
        offset,
        total: records.length,
        entries: records.slice(offset, offset + blockSize),
      }),
      "application/json; charset=utf-8",
    );
  }
  const page = Number(url.searchParams.get("page") ?? "1"),
    count = Math.max(1, Math.ceil(records.length / pageSize));
  if (!Number.isSafeInteger(page) || page < 1 || page > count)
    return new Response("Page not found", {
      status: 404,
      headers: { "cache-control": "no-store" },
    });
  const pageHref = (number: number) =>
    hrefForDirectory(logicalPath) + (number === 1 ? "" : `?page=${number}`);
  const context: ThemeContext = {
    ...baseContext,
    directory: {
      ...directory,
      entries: directory.entries.slice((page - 1) * pageSize, page * pageSize),
    },
    listing: {
      revision,
      manifestHref: virtualHref("listing/manifest", { path: logicalPath }),
      page: {
        number: page,
        count,
        offset: (page - 1) * pageSize,
        total: records.length,
        href: pageHref(page),
        previousHref: page > 1 ? pageHref(page - 1) : null,
        nextHref: page < count ? pageHref(page + 1) : null,
      },
    },
  };
  const rendered = await theme.render(context);
  if (route === "/__dirwell/page") {
    for (const [name, asset] of Object.entries(rendered.assets ?? {})) {
      if (!name.endsWith(".json") || typeof asset !== "string") continue;
      try {
        const data = JSON.parse(asset);
        if (
          data?.version === 1 &&
          data.theme === theme.name &&
          data.path === logicalPath &&
          Array.isArray(data.entries)
        )
          return respond(asset, "application/json; charset=utf-8");
      } catch {
        /* Other theme assets are not page snapshots. */
      }
    }
    return new Response("Theme has no page snapshot", { status: 404 });
  }
  if (route === "/__dirwell/asset") {
    const name = url.searchParams.get("name");
    if (name === null || !Object.hasOwn(rendered.assets ?? {}, name))
      return new Response("Asset not found", { status: 404 });
    const asset = rendered.assets![name]!;
    const types: Record<string, string> = {
      ".js": "text/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
    };
    return respond(asset, types[path.extname(name)] ?? "application/octet-stream");
  }
  return respond(rendered.html, "text/html; charset=utf-8");
}
