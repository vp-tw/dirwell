import test from "node:test";
import Fastify from "fastify";
import { createFastifyPlugin } from "../packages/server/src/fastify.ts";
import { createNodeRequestListener } from "../packages/server/src/node.ts";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("adapter types register with native Node and Fastify without a cast", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-adapter-types-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const listener = await createNodeRequestListener({ root });
  createServer(listener);
  const host = Fastify();
  context.after(() => host.close());
  host.register(await createFastifyPlugin({ root, mountPath: "/files" }));
  await host.ready();
});
