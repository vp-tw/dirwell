import type { IncomingMessage, ServerResponse } from "node:http";
import { createNodeRequestListener } from "./node.ts";
import type { ExplorerHandlerOptions } from "./index.ts";
interface FastifyHost {
  route(options: {
    method: ("GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS")[];
    url: string;
    handler: (
      request: { raw: IncomingMessage },
      reply: { raw: ServerResponse; hijack(): unknown },
    ) => Promise<void>;
  }): unknown;
}
/** Register a dedicated route tree; host lifecycle stays with Fastify. */
export async function createFastifyPlugin(options: ExplorerHandlerOptions) {
  const listener = await createNodeRequestListener(options);
  return async (host: FastifyHost): Promise<void> => {
    const handler = async (
      request: { raw: IncomingMessage },
      reply: { raw: ServerResponse; hijack(): unknown },
    ) => {
      reply.hijack();
      await listener(request.raw, reply.raw);
    };
    const method: ("GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS")[] = [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ];
    host.route({ method, url: `${options.mountPath ?? ""}/*`, handler });
    if (options.mountPath) host.route({ method, url: options.mountPath, handler });
  };
}
