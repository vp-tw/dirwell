import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createExplorerHandler, type ExplorerHandlerOptions } from "./index.ts";

export interface NodeBridgeOptions {
  readonly requestTarget?: (request: IncomingMessage) => string;
}
/** Integrate with an existing Node HTTP server; file transport stays opt-in. */
export async function createNodeRequestListener(
  options: ExplorerHandlerOptions,
  bridge: NodeBridgeOptions = {},
) {
  const handler = await createExplorerHandler(options);
  return async (incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> => {
    const abort = new AbortController();
    outgoing.once("close", () => abort.abort());
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) for (const item of value) headers.append(name, item);
        else if (value !== undefined) headers.set(name, value);
      }
      const request = new Request(
        new URL(bridge.requestTarget?.(incoming) ?? incoming.url ?? "/", "http://localhost"),
        {
          method: incoming.method ?? "GET",
          headers,
          signal: abort.signal,
        },
      );
      const response = await handler(request);
      outgoing.statusCode = response.status;
      response.headers.forEach((value, name) => outgoing.setHeader(name, value));
      if (response.body === null) {
        outgoing.end();
        return;
      }
      const reader = response.body.getReader();
      try {
        while (!outgoing.destroyed) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!outgoing.write(value))
            await new Promise<void>((resolve, reject) => {
              const cleanup = () => {
                outgoing.off("drain", drain);
                outgoing.off("close", closed);
                outgoing.off("error", failed);
              };
              const drain = () => {
                cleanup();
                resolve();
              };
              const closed = () => {
                cleanup();
                reject(new Error("Connection closed"));
              };
              const failed = (error: Error) => {
                cleanup();
                reject(error);
              };
              if (outgoing.destroyed) {
                reject(new Error("Connection closed"));
                return;
              }
              outgoing.once("drain", drain);
              outgoing.once("close", closed);
              outgoing.once("error", failed);
            });
        }
        outgoing.end();
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch {
      if (outgoing.headersSent) {
        outgoing.destroy();
        return;
      }
      outgoing
        .writeHead(500, { "cache-control": "no-store", "content-type": "text/plain" })
        .end("Internal server error");
    }
  };
}
/** Standalone Node server; defaults to loopback and safe media previews. */
export async function startExplorerServer(
  options: ExplorerHandlerOptions & { readonly host?: string; readonly port?: number },
) {
  const listener = await createNodeRequestListener({ files: "media", ...options });
  const server = createServer(listener);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, options.host ?? "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("Server address unavailable");
  }
  return {
    url: `http://${address.family === "IPv6" ? `[${address.address}]` : address.address}:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeIdleConnections();
        server.closeAllConnections();
      }),
  };
}
