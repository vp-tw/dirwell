import { mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { build, createServer, preview } from "vite-upstream";
import dirwellVite from "../../src/vite.ts";

for (const mode of ["ssg", "mpa"]) {
  test(`Vite ${mode} dev server serves and refreshes generated pages`, async ({ page }) => {
    test.setTimeout(30_000);
    const root = await mkdtemp(path.join(tmpdir(), "dirwell-vite-browser-"));
    const source = path.join(root, "files");
    await mkdir(source);
    await writeFile(path.join(source, "README.txt"), "a");
    await writeFile(path.join(root, "index.html"), "<main>Host application</main>");
    const output = mode === "mpa" ? "dist/catalog" : undefined;
    const mount = mode === "mpa" ? "/app/catalog/" : "/app/dirwell/";
    const server = await createServer({
      root,
      configFile: false,
      base: "/app/",
      logLevel: "silent",
      plugins: [
        dirwellVite({ root: "files", mode, ...(output === undefined ? {} : { outDir: output }) }),
      ],
      server: { host: "127.0.0.1", port: 0 },
    });
    try {
      await server.listen();
      const local = server.resolvedUrls?.local[0];
      if (local === undefined) throw new Error("Vite did not expose a local URL");
      await page.goto(new URL(mount, local).href);
      await expect(page.getByRole("link", { name: "README.txt" })).toBeVisible();
      expect(
        (
          await page.request.get(new URL(mount.slice(0, -1), local).href, { maxRedirects: 0 })
        ).status(),
      ).toBe(308);
      expect((await page.request.get(new URL(`${mount}missing.txt`, local).href)).status()).toBe(
        404,
      );
      await expect(page.locator('[data-name="README.txt"]')).toContainText("1 B");
      await writeFile(path.join(source, "README.txt"), "edited content");
      await expect(page.locator('[data-name="README.txt"]')).toContainText("14 B");
      await writeFile(path.join(source, "new.txt"), "new");
      await expect(page.getByRole("link", { name: "new.txt" })).toBeVisible();
      await rename(path.join(source, "new.txt"), path.join(source, "renamed.txt"));
      await expect(page.getByRole("link", { name: "renamed.txt" })).toBeVisible();
      await expect(page.getByRole("link", { name: "new.txt" })).toHaveCount(0);
      await rm(path.join(source, "renamed.txt"));
      await expect(page.getByRole("link", { name: "renamed.txt" })).toHaveCount(0);
      const preservedHtml = await page.request.get(new URL(mount, local).href);
      await mkdir(path.join(source, "__dirwell"));
      await writeFile(path.join(source, "README.txt"), "longer edited content");
      await expect(page.locator("vite-error-overlay")).toHaveCount(1);
      expect(await (await page.request.get(new URL(mount, local).href)).text()).toBe(
        await preservedHtml.text(),
      );
      await rm(path.join(source, "__dirwell"), { recursive: true });
      await expect(page.locator('[data-name="README.txt"]')).toContainText("21 B");
      const hostResponse = await page.request.get(new URL("/app/", local).href);
      expect(hostResponse.status()).toBe(200);
      expect(await hostResponse.text()).toContain("Host application");
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("Vite options array serves and refreshes separate mounts", async ({ page }) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-vite-array-browser-"));
  await mkdir(path.join(root, "notes"));
  await mkdir(path.join(root, "releases"));
  await writeFile(path.join(root, "notes", "note.txt"), "note");
  await writeFile(path.join(root, "releases", "release.txt"), "release");
  await writeFile(path.join(root, "index.html"), "<main>Host application</main>");
  const server = await createServer({
    root,
    configFile: false,
    base: "/app/",
    logLevel: "silent",
    plugins: dirwellVite([
      { root: "notes", outDir: "dist/notes", mode: "ssg" },
      { root: "releases", outDir: "dist/releases", mode: "mpa" },
    ]),
    server: { host: "127.0.0.1", port: 0 },
  });
  try {
    await server.listen();
    const local = server.resolvedUrls?.local[0];
    if (local === undefined) throw new Error("Vite did not expose a local URL");
    await page.goto(new URL("/app/notes/", local).href);
    await expect(page.getByRole("link", { name: "note.txt" })).toBeVisible();
    await page.goto(new URL("/app/releases/", local).href);
    await expect(page.getByRole("link", { name: "release.txt" })).toBeVisible();
    await writeFile(path.join(root, "notes", "new.txt"), "new");
    await page.goto(new URL("/app/notes/", local).href);
    await expect(page.getByRole("link", { name: "new.txt" })).toBeVisible();
    expect((await page.request.get(new URL("/app/releases/new.txt", local).href)).status()).toBe(
      404,
    );
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("Vite dev excludes its previous output when the project root is the source", async ({
  page,
}) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-vite-root-browser-"));
  const previousOutput = path.join(root, "dist", "dirwell");
  await mkdir(previousOutput, { recursive: true });
  await writeFile(path.join(previousOutput, ".dirwell-vite-output"), "dirwell-vite-v1\n");
  await writeFile(path.join(previousOutput, "old.txt"), "previous build");
  await writeFile(path.join(root, "index.html"), "<main>Host application</main>");
  const server = await createServer({
    root,
    configFile: false,
    base: "/app/",
    logLevel: "silent",
    plugins: [dirwellVite({ root: ".", include: ["index.html", "dist/**"] })],
    server: { host: "127.0.0.1", port: 0 },
  });
  try {
    await server.listen();
    const local = server.resolvedUrls?.local[0];
    if (local === undefined) throw new Error("Vite did not expose a local URL");
    const explorer = new URL("/app/dirwell/_dirwell.html", local).href;
    await page.goto(explorer);
    await expect(page.locator("[data-explorer]")).toBeVisible();
    expect(
      (await page.request.get(new URL("/app/dirwell/dist/dirwell/old.txt", local).href)).status(),
    ).toBe(404);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("Vite production build publishes the explorer under a non-root base", async ({ page }) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-vite-production-"));
  await mkdir(path.join(root, "files"));
  await writeFile(path.join(root, "files", "README.txt"), "published file\n");
  await writeFile(path.join(root, "index.html"), "<main>Host application</main>");
  let server;
  try {
    await build({
      root,
      configFile: false,
      base: "/app/",
      logLevel: "silent",
      plugins: [dirwellVite({ root: "files", mode: "mpa" })],
      build: { outDir: "dist" },
    });
    server = await preview({
      root,
      configFile: false,
      base: "/app/",
      logLevel: "silent",
      preview: { host: "127.0.0.1", port: 0 },
    });
    const address = server.httpServer.address();
    if (address === null || typeof address === "string") throw new Error("No preview port");
    const url = `http://127.0.0.1:${address.port}/app/dirwell/`;
    await page.goto(url);
    const readme = page.getByRole("link", { name: "README.txt" });
    await expect(readme).toBeVisible();
    const [popup] = await Promise.all([page.waitForEvent("popup"), readme.click()]);
    await expect(popup.locator("body")).toContainText("published file");
    await popup.close();
    expect(
      await (await page.request.get(`http://127.0.0.1:${address.port}/app/`)).text(),
    ).toContain("Host application");
  } finally {
    if (server !== undefined) {
      await new Promise((resolve, reject) =>
        server.httpServer.close((error) => (error ? reject(error) : resolve())),
      );
    }
    await rm(root, { recursive: true, force: true });
  }
});
