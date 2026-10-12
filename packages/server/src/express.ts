import type { IncomingMessage, ServerResponse } from "node:http";
import { createNodeRequestListener } from "./node.ts";
import type { ExplorerHandlerOptions } from "./index.ts";
type ExpressRequest = IncomingMessage & { readonly originalUrl?: string };
/** Express-compatible middleware without installing Express into Dirwell. */
export async function createExpressMiddleware(options: ExplorerHandlerOptions) {
  const listener = await createNodeRequestListener(options, {
    requestTarget: (request) => (request as ExpressRequest).originalUrl ?? request.url ?? "/",
  });
  return (
    request: ExpressRequest,
    response: ServerResponse,
    next: (error?: unknown) => void,
  ): void => {
    void listener(request, response).catch(next);
  };
}
