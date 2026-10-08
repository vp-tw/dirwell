import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createRsbuild } from "@rsbuild/core";
import unplugin from "../../src/unplugin.ts";

test("Rsbuild serves rebuilt explorer assets through its native dev server", async ({ page }) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-rsbuild-browser-"));
  await mkdir(path.join(root, "files"));
  await writeFile(path.join(root, "files/note.txt"), "original");
  await writeFile(path.join(root, "entry.js"), "console.log('host');");
  const rsbuild = await createRsbuild({
    cwd: root,
    rsbuildConfig: {
      source: { entry: { index: "./entry.js" } },
      server: { host: "127.0.0.1", port: 0, open: false },
      performance: { printFileSize: false },
      plugins: [unplugin.rsbuild({ root: "files" })],
    },
  });
  const server = await rsbuild.createDevServer();
  try {
    const { urls } = await server.listen();
    const local = new URL("dirwell/", urls[0]).href;
    await page.goto(local);
    await expect(page.getByRole("link", { name: "note.txt" })).toBeVisible();
    await writeFile(path.join(root, "files/created.txt"), "new");
    await expect
      .poll(async () => (await page.request.get(`${local}created.txt`)).status())
      .toBe(200);
    await page.reload();
    await expect(page.getByRole("link", { name: "created.txt" })).toBeVisible();
    await rm(path.join(root, "files/created.txt"));
    await expect
      .poll(async () => (await (await page.request.get(local)).text()).includes("created.txt"))
      .toBe(false);
    await page.reload();
    await expect(page.getByRole("link", { name: "created.txt" })).toHaveCount(0);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});
