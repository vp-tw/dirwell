import { watch } from "node:fs";
import { open, stat, type FileHandle } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import path from "node:path";
import { generateExplorer } from "./generator.ts";
import type { GenerateOptions } from "./model.ts";

function reloadClient(eventsPath: string): string {
  return `<script>
const events=new EventSource(${JSON.stringify(eventsPath)});
events.addEventListener('reload',()=>location.reload());
</script>`;
}

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function send(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  response.end(body);
}

export async function createExplorerDevServer(
  options: GenerateOptions & { readonly host?: string; readonly port?: number },
) {
  const outputDir = path.resolve(options.outputDir);
  const mountPath =
    options.urlStrategy === "base" || options.urlStrategy === "html-base"
      ? `${new URL(options.base ?? "/", "http://dirwell.local").pathname.replace(/\/+$/, "")}/`
      : "/";
  const eventsPath = `${mountPath}__explorer/events`;
  const clients = new Set<ServerResponse>();
  let activeBuild: Promise<void> | null = null;
  let rebuildRequested = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function rebuild(): Promise<void> {
    if (activeBuild !== null) {
      rebuildRequested = true;
      return activeBuild;
    }
    const task = (async () => {
      do {
        rebuildRequested = false;
        await generateExplorer(options);
        for (const client of clients) client.write("event: reload\ndata: updated\n\n");
      } while (rebuildRequested);
    })();
    activeBuild = task;
    try {
      await task;
    } finally {
      activeBuild = null;
    }
  }

  await rebuild();

  const fileWatcher = watch(options.sourceDir, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      void rebuild().catch((error: unknown) => {
        console.error("Dirwell rebuild failed; serving the last successful build", error);
      });
    }, 60);
  });

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    if (requestUrl.pathname === eventsPath) {
      response.writeHead(200, {
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream",
      });
      response.write(": connected\n\n");
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }

    if (requestUrl.pathname === mountPath.slice(0, -1)) {
      response.writeHead(308, { location: mountPath });
      response.end();
      return;
    }
    if (!requestUrl.pathname.startsWith(mountPath)) {
      send(response, 404, "Not found");
      return;
    }
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(`/${requestUrl.pathname.slice(mountPath.length)}`);
    } catch {
      send(response, 400, "Invalid URL encoding");
      return;
    }
    let filePath = path.resolve(outputDir, `.${decodedPath}`);
    if (!filePath.startsWith(`${outputDir}${path.sep}`) && filePath !== outputDir) {
      send(response, 403, "Forbidden");
      return;
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      // A completed build replaces this directory. Wait before resolving a path,
      // then keep an open file descriptor so replacement cannot invalidate reads.
      await activeBuild?.catch(() => {});
      let handle: FileHandle | undefined;
      try {
        if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
        handle = await open(filePath, "r");
        const fileStats = await handle.stat();
        if (!fileStats.isFile()) throw new Error("Not a file");
        const extension = path.extname(filePath).toLowerCase();
        const headers: Record<string, string | number> = {
          "cache-control": "no-store",
          "content-type": contentTypes[extension] ?? "application/octet-stream",
        };
        if (extension === ".html") {
          const html = await handle.readFile("utf8");
          await handle.close();
          handle = undefined;
          response.writeHead(200, headers);
          response.end(html.replace("</body>", `${reloadClient(eventsPath)}</body>`));
        } else {
          headers["content-length"] = fileStats.size;
          const stream = handle.createReadStream();
          handle = undefined;
          stream.on("error", (error) => response.destroy(error));
          response.once("close", () => stream.destroy());
          response.writeHead(200, headers);
          stream.pipe(response);
        }
        return;
      } catch (error) {
        await handle?.close().catch(() => {});
        if (
          attempt === 0 &&
          activeBuild !== null &&
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        )
          continue;
        if (response.headersSent) response.destroy();
        else send(response, 404, "Not found");
        return;
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 4173, options.host ?? "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : options.port;

  return {
    url: `http://${options.host ?? "127.0.0.1"}:${port ?? 4173}${mountPath}`,
    async close(): Promise<void> {
      clearTimeout(timer);
      fileWatcher.close();
      for (const client of clients) client.end();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}
