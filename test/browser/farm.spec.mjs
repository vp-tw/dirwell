import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { resolveConfig, createCompiler, createDevServer, Logger } from "@farmfe/core";
import unplugin from "../../src/unplugin.ts";

test("Farm dev serves and reloads explorer assets after source creation and deletion", async ({
  page,
}) => {
  test.setTimeout(30_000);
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-farm-browser-"));
  await mkdir(path.join(root, "files"));
  await writeFile(path.join(root, "files/note.txt"), "original");
  await writeFile(path.join(root, "entry.js"), "console.log('host');");
  const logger = new Logger({ level: "error" });
  const config = await resolveConfig(
    {
      root,
      server: { host: "127.0.0.1", port: 0, open: false },
      compilation: {
        input: { index: "./entry.js" },
        output: { path: "dist", publicPath: "/app/" },
        persistentCache: false,
        lazyCompilation: false,
      },
      plugins: [unplugin.farm({ root: "files" })],
    },
    "development",
    logger,
    false,
  );
  const compiler = await createCompiler(config, logger);
  const server = await createDevServer(compiler, config, logger);
  try {
    await server.listen();
    const address = server.server.address();
    const local = `http://127.0.0.1:${address.port}/app/dirwell/`;
    await page.goto(local);
    await expect(page.getByRole("link", { name: "note.txt" })).toBeVisible();
    expect(await (await page.request.get(`${local}note.txt`)).text()).toBe("original");
    await writeFile(path.join(root, "files/created.txt"), "new");
    await expect(page.getByRole("link", { name: "created.txt" })).toBeVisible();
    await rm(path.join(root, "files/created.txt"));
    await expect(page.getByRole("link", { name: "created.txt" })).toHaveCount(0);
    expect((await page.request.get(`${local}created.txt`)).status()).toBe(404);
  } finally {
    await server.watcher?.getInternalWatcher()?.close();
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
