import { Hono } from "hono";
import { createClient } from "redis";
import { createExplorerHandler } from "@dirwell/server";
import { createPlainTheme } from "@dirwell/theme-plain";
import { createListingCache } from "./cache.mjs";

export async function createApp({ root, redisUrl, dataset, serverId, ttlMs = 10000 }) {
  const handler = await createExplorerHandler({
    root,
    theme: createPlainTheme(),
    files: "attachment",
    mountPath: "/downloads",
  });
  const redis = createClient({
    url: redisUrl,
    disableOfflineQueue: true,
    commandsQueueMaxLength: 32,
    commandOptions: { timeout: 500 },
    socket: { connectTimeout: 1000 },
  });
  // Requests bypass Redis while it reconnects. The client owns retry timing.
  redis.on("error", () => {});
  void redis.connect().catch(() => {});

  const readListing = createListingCache({ handler, redis, dataset, ttlMs });
  const app = new Hono();
  app.use("*", async (context, next) => {
    await next();
    context.header("X-Server-Id", serverId);
  });
  app.get("/", (context) => context.redirect("/downloads/browse/"));
  app.get("/health", (context) => context.json({ cacheReady: redis.isReady }));
  app.get("/api/files", async (context) => {
    if (new URL(context.req.url).search)
      return context.text("This example API lists the source root without query parameters.", 400);
    const { data, cache, sourceReads } = await readListing();
    return context.json(data, 200, {
      "Cache-Control": "no-store",
      "X-Listing-Cache": cache,
      "X-Source-Reads": String(sourceReads),
    });
  });
  app.all("/downloads", (context) => handler(context.req.raw));
  app.all("/downloads/*", (context) => handler(context.req.raw));
  return {
    app,
    redis,
    close: () => {
      if (redis.isOpen) redis.destroy();
    },
  };
}
