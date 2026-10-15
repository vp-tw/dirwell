import { serve } from "@hono/node-server";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createApp } from "./app.mjs";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isSafeInteger(port) || port < 0 || port > 65535)
  throw new TypeError("PORT must be an integer from 0 to 65535");
const serverId = process.env.SERVER_ID ?? `node-${process.pid}`;
const application = await createApp({
  root: process.env.FILES_DIR
    ? path.resolve(process.env.FILES_DIR)
    : fileURLToPath(new URL("./files/", import.meta.url)),
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6380",
  dataset: process.env.DATASET_ID ?? "shared-cache-example",
  serverId,
});
const server = serve({ fetch: application.app.fetch, hostname: "127.0.0.1", port }, (address) => {
  const url = `http://127.0.0.1:${address.port}`;
  console.log(`${serverId}: ${url}/downloads/browse/`);
  console.log(`Public listing API: ${url}/api/files`);
  process.send?.({ event: "ready", url });
});
const close = () => {
  application.close();
  server.close();
  server.closeAllConnections();
};
process.once("SIGINT", close);
process.once("SIGTERM", close);
server.on("error", (error) => {
  application.close();
  console.error(error.message);
  process.exitCode = 1;
});
