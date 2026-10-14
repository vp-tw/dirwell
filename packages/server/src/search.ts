import { SelectionBudgetError, type DirectoryService } from "@dirwell/core";
import type { ExplorerHandlerOptions } from "./index.ts";
export interface LiveSearchOptions {
  readonly maxEntries?: number;
  readonly maxDirectories?: number;
  readonly maxConcurrent?: number;
  readonly maxResults?: number;
  readonly timeoutMs?: number;
  readonly refreshIntervalMs?: number;
}
async function abortable<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return operation();
      })
      .then(
        (value) => {
          signal.removeEventListener("abort", abort);
          resolve(value);
        },
        (error) => {
          signal.removeEventListener("abort", abort);
          reject(error);
        },
      );
  });
}
const fold = (value: string) => value.normalize("NFKC").toLowerCase();
const encode = (value: string) => value.split("/").map(encodeURIComponent).join("/");
export function createSearchHandler(
  options: ExplorerHandlerOptions,
  service: DirectoryService,
  headersFor: (request: Request, headers: Headers) => Promise<Headers>,
): (request: Request) => Promise<Response> {
  let active = 0;
  return async (request) => {
    const config = options.search;
    const response = (message: string, status: number) =>
      new Response(message, { status, headers: { "cache-control": "no-store" } });
    if (!config) return response("Not found", 404);
    if (request.method !== "GET")
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET", "cache-control": "no-store" },
      });
    const params = new URL(request.url).searchParams;
    const query = params.get("q")?.trim() ?? "";
    const subtree = params.get("path") ?? "";
    const limit = Number(params.get("limit") ?? config.maxResults ?? 100);
    if (
      !query ||
      query.length > 256 ||
      subtree.length > 4096 ||
      subtree.startsWith("/") ||
      subtree.includes("\\") ||
      subtree.includes("\0") ||
      /^[a-z]:/i.test(subtree) ||
      (subtree !== "" &&
        subtree.split("/").some((segment) => !segment || segment === "." || segment === "..")) ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > (config.maxResults ?? 100) ||
      [...params.keys()].some((key) => !["q", "path", "limit"].includes(key))
    )
      return response("Invalid search query", 400);
    if (active >= (config.maxConcurrent ?? 2))
      return new Response("Search busy", {
        status: 429,
        headers: { "retry-after": "1", "cache-control": "no-store" },
      });
    active++;
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(config.timeoutMs ?? 5000)]);
    const authorized = async (logical: string): Promise<boolean> => {
      signal.throwIfAborted();
      const authorize = options.authorize;
      if (!authorize) return true;
      return abortable(signal, async () => (await authorize(request, logical)) === true);
    };
    try {
      if (!(await authorized(subtree))) return response("Forbidden", 403);
      const within = (logical: string) =>
        !subtree || logical === subtree || logical.startsWith(subtree + "/");
      const entries = await service.scan({
        maxEntries: config.maxEntries ?? 10000,
        maxDirectories: config.maxDirectories ?? 1000,
        signal,
        async allowPath(logical) {
          signal.throwIfAborted();
          if (logical !== "" && !within(logical) && !subtree.startsWith(logical + "/"))
            return false;
          return authorized(logical);
        },
      });
      const matches = entries.filter(
        (entry) => within(entry.relativePath) && fold(entry.relativePath).includes(fold(query)),
      );
      const mount = options.mountPath ?? "";
      const results = matches.slice(0, limit).map((entry) => ({
        name: entry.name,
        path: entry.relativePath,
        kind: entry.kind,
        href:
          entry.kind === "directory"
            ? options.theme
              ? `${mount}/browse/${encode(entry.relativePath)}/`
              : `${mount}/listing?path=${encodeURIComponent(entry.relativePath)}`
            : (options.fileHref?.(entry.relativePath) ??
              (options.files ? `${mount}/files/${encode(entry.relativePath)}` : null)),
      }));
      const headers = await abortable(signal, () =>
        headersFor(
          request,
          new Headers({
            "content-type": "application/json; charset=utf-8",
            "x-content-type-options": "nosniff",
          }),
        ),
      );
      // Search results are always request-local, including when the host customizes headers.
      headers.set("cache-control", options.authorize ? "private, no-store" : "no-store");
      return Response.json(
        { version: 1, query, path: subtree, results, truncated: matches.length > limit },
        { headers },
      );
    } catch (error) {
      if (error instanceof SelectionBudgetError)
        return response("Search scan budget exceeded", 503);
      if (signal.aborted)
        return response(request.signal.aborted ? "Search aborted" : "Search timed out", 503);
      throw error;
    } finally {
      active--;
    }
  };
}
