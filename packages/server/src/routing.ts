import { directoryRoute, encodeLogicalPath, resolveDirectoryUrls } from "@dirwell/core";
import type { ExplorerHandlerOptions } from "./index.ts";

/** HTML routing is shared by listing, search and native navigation. */
export function browseHref(logicalPath: string, options: ExplorerHandlerOptions): string {
  const style = resolveDirectoryUrls(options.routing);
  const publicPath = directoryRoute(logicalPath, "index.html", style).publicPath;
  return `${options.mountPath ?? ""}/browse${publicPath || style !== "clean" ? "/" : ""}${encodeLogicalPath(publicPath)}`;
}
