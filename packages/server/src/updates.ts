import { createHash } from "node:crypto";
import { projectListingEntry } from "@dirwell/core";
import type { DirectoryService } from "@dirwell/core";
import type { ExplorerHandlerOptions } from "./index.ts";
import { resolveAuthorizedDirectory } from "./authorization.ts";
interface Subscriber {
  readonly request: Request;
  readonly requestedPath: string;
  readonly controller: ReadableStreamDefaultController<Uint8Array>;
  readonly close: () => void;
  revision: string;
  heartbeat: number;
  closed: boolean;
}
interface SubscriptionGroup {
  readonly path: string;
  readonly subscribers: Set<Subscriber>;
  timer?: ReturnType<typeof setInterval>;
  active: boolean;
  revision: string;
}
/** Share one poll per canonical directory; slow clients receive the newest revision. */
export function createUpdatesHandler(
  options: ExplorerHandlerOptions,
  service: DirectoryService,
  headersFor: (request: Request, headers: Headers) => Promise<Headers>,
) {
  const interval = options.live ? (options.live.intervalMs ?? 1000) : 1000,
    maximum = options.live ? (options.live.maxClients ?? 32) : 32;
  if (
    !Number.isSafeInteger(interval) ||
    interval < 25 ||
    !Number.isSafeInteger(maximum) ||
    maximum < 1
  )
    throw new TypeError("Invalid live update limits");
  const groups = new Map<string, SubscriptionGroup>(),
    encoder = new TextEncoder();
  let clients = 0;
  const allowed = async (client: Subscriber, path: string) =>
    options.authorize === undefined ||
    ((await options.authorize(client.request, client.requestedPath)) === true &&
      (client.requestedPath === path || (await options.authorize(client.request, path)) === true));
  const emit = (group: SubscriptionGroup, client: Subscriber) => {
    if (client.closed || !group.revision || !(Number(client.controller.desiredSize) > 0)) return;
    if (client.revision !== group.revision) {
      client.controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ version: 1, revision: group.revision })}\n\n`),
      );
      client.revision = group.revision;
    } else if (Date.now() - client.heartbeat >= 15_000) {
      client.heartbeat = Date.now();
      client.controller.enqueue(encoder.encode(": heartbeat\n\n"));
    }
  };
  const poll = async (group: SubscriptionGroup) => {
    if (group.active || group.subscribers.size === 0) return;
    group.active = true;
    try {
      const authorized: Subscriber[] = [];
      for (const client of group.subscribers) {
        try {
          if (await allowed(client, group.path)) {
            if (!client.closed) authorized.push(client);
          } else client.close();
        } catch {
          client.close();
        }
      }
      if (authorized.length === 0) return;
      const directory = await service.listDirectory(group.path);
      const records = directory.entries.map((entry) =>
        projectListingEntry(entry, { hrefFor: () => null, exitsExplorerFor: () => false }),
      );
      group.revision = createHash("sha256").update(JSON.stringify(records)).digest("hex");
      for (const client of group.subscribers) {
        try {
          if (await allowed(client, group.path)) emit(group, client);
          else client.close();
        } catch {
          client.close();
        }
      }
    } catch {
      for (const client of group.subscribers) client.close();
    } finally {
      group.active = false;
    }
  };
  return async (request: Request): Promise<Response> => {
    if (!options.live) return new Response("Live updates disabled", { status: 404 });
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    const requested = new URL(request.url).searchParams.get("path") ?? "";
    const resolved = await resolveAuthorizedDirectory(
      request,
      requested,
      service,
      options.authorize,
    );
    if ("response" in resolved) return resolved.response;
    if ((await service.getEntry(resolved.path)).kind !== "directory")
      return new Response("Not found", { status: 404 });
    const headers = await headersFor(
      request,
      new Headers({
        "content-type": "text/event-stream; charset=utf-8",
        "x-accel-buffering": "no",
      }),
    );
    headers.set("cache-control", options.authorize ? "private, no-store" : "no-store");
    if (request.method === "HEAD") return new Response(null, { headers });
    if (clients >= maximum)
      return new Response("Live client limit reached", {
        status: 429,
        headers: { "retry-after": "5", "cache-control": "no-store" },
      });
    let group = groups.get(resolved.path);
    if (!group) {
      group = { path: resolved.path, subscribers: new Set(), active: false, revision: "" };
      groups.set(resolved.path, group);
    }
    const subscription = group;
    let client: Subscriber;
    const cleanup = () => {
      if (client.closed) return;
      client.closed = true;
      clients--;
      request.signal.removeEventListener("abort", close);
      subscription.subscribers.delete(client);
      if (subscription.subscribers.size === 0) {
        clearInterval(subscription.timer);
        groups.delete(subscription.path);
      }
    };
    const close = () => {
      cleanup();
      try {
        client.controller.close();
      } catch {
        /* Cancellation may have closed the stream already. */
      }
    };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        client = {
          request,
          requestedPath: requested,
          controller,
          close,
          closed: false,
          revision: "",
          heartbeat: Date.now(),
        };
        clients++;
        subscription.subscribers.add(client);
        controller.enqueue(encoder.encode(": connected\n\n"));
        request.signal.addEventListener("abort", close, { once: true });
        if (request.signal.aborted) {
          close();
          return;
        }
        if (subscription.timer === undefined)
          subscription.timer = setInterval(() => void poll(subscription), interval);
        if (!subscription.revision) void poll(subscription);
      },
      async pull() {
        if (client.closed || subscription.revision === client.revision) return;
        try {
          if (await allowed(client, subscription.path)) emit(subscription, client);
          else close();
        } catch {
          close();
        }
      },
      cancel() {
        cleanup();
      },
    });
    return new Response(stream, { headers });
  };
}
