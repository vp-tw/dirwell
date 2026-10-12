import type { DirectoryService } from "@dirwell/core";
import type { ExplorerHandlerOptions } from "./index.ts";
/** Resolve aliases before reading directory children or producing cache validators. */
export async function resolveAuthorizedDirectory(
  request: Request,
  requestedPath: string,
  service: DirectoryService,
  authorize: ExplorerHandlerOptions["authorize"],
): Promise<{ readonly path: string } | { readonly response: Response }> {
  const denied = () => ({
    response: new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } }),
  });
  if (authorize && (await authorize(request, requestedPath)) !== true) return denied();
  const canonical = await service.resolvePath(requestedPath);
  if (canonical !== requestedPath && authorize && (await authorize(request, canonical)) !== true)
    return denied();
  return { path: canonical };
}
