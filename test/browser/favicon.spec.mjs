import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { directoryRoute } from "../../packages/core/src/routing.ts";
import { generateExplorer } from "../../packages/core/dist/index.mjs";
import { createLedgerTheme } from "../../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../../packages/theme-crosswave/dist/index.mjs";

async function verifyIcons(page, custom = false, scriptEnabled = true) {
  const icons = await page
    .locator('head link[rel="icon"]')
    .evaluateAll((links) =>
      links.map((link) => ({ href: link.href, type: link.type, sizes: link.sizes.value })),
    );
  expect(icons.map(({ sizes }) => sizes)).toEqual(custom ? ["32x32"] : ["16x16", "32x32", "48x48"]);
  for (const icon of icons) {
    expect(icon.type).toBe("image/png");
    const response = await page.request.get(icon.href);
    expect(response.status()).toBe(200);
    const size = Number(icon.sizes.split("x")[0]);
    expect(await response.body()).toEqual(
      await readFile(new URL(`../../docs/public/brand/favicon-${size}.png`, import.meta.url)),
    );
    // Firefox leaves Image.decode() pending when page scripts are disabled.
    // Native coverage checks the link and bytes; enabled pages also decode the image.
    if (!scriptEnabled) continue;
    const dimensions = await page.evaluate(async (href) => {
      const image = new Image();
      image.src = href;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, icon.href);
    expect(dimensions).toEqual([size, size]);
  }
}

for (const [name, factory] of [
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
])
  for (const mode of ["ssg", "mpa"])
    for (const urlStrategy of ["relative", "base", "html-base"])
      for (const directoryUrls of ["explicit", "slash", "clean"])
        test(`${name} ${mode}/${urlStrategy}/${directoryUrls}: favicon follows folder navigation, history and native loads`, async ({
          page,
          browser,
        }) => {
          const root = await mkdtemp(path.join(tmpdir(), "dirwell-favicon-browser-"));
          const sourceDir = path.join(root, "files"),
            outputDir = path.join(root, "out");
          const custom = urlStrategy === "base";
          const route = (directory) =>
            directoryRoute(directory, "index.html", directoryUrls).publicPath;
          let server;
          try {
            await mkdir(path.join(sourceDir, "nested/deep"), { recursive: true });
            await writeFile(path.join(sourceDir, "nested/deep/note.txt"), "File");
            await generateExplorer({
              sourceDir,
              outputDir,
              mode,
              urlStrategy,
              base: "/downloads/",
              routing: { directoryUrls },
              theme: factory({
                ...(name === "ledger" ? {} : { backgroundMotion: false, gamepad: false }),
                ...(custom
                  ? {
                      brand: {
                        favicon: {
                          source: new URL(
                            "../../docs/public/brand/favicon-32.png",
                            import.meta.url,
                          ),
                          sizes: "32x32",
                          media: "screen",
                        },
                      },
                    }
                  : {}),
              }),
            });
            server = createServer(async (request, response) => {
              try {
                const url = new URL(request.url, "http://test");
                if (!url.pathname.startsWith("/downloads/")) throw new Error("Outside mount");
                const relative = decodeURIComponent(url.pathname.slice("/downloads/".length));
                let file = path.resolve(
                  outputDir,
                  relative.endsWith("/") || !relative ? relative + "index.html" : relative,
                );
                if (directoryUrls === "clean" && relative && !path.extname(relative))
                  file += ".html";
                if (!file.startsWith(outputDir + path.sep)) throw new Error("Outside output");
                const types = {
                  ".html": "text/html",
                  ".js": "text/javascript",
                  ".json": "application/json",
                  ".png": "image/png",
                };
                response
                  .writeHead(200, {
                    "content-type": types[path.extname(file)] ?? "application/octet-stream",
                  })
                  .end(await readFile(file));
              } catch {
                response.writeHead(404).end();
              }
            });
            await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
            const base = `http://127.0.0.1:${server.address().port}/downloads/`;
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            await page.goto(base + route(""));
            await expect(page.getByRole("searchbox").first()).toBeEnabled();
            await verifyIcons(page, custom);
            await page.evaluate(() => {
              window.faviconNavigationMarker = true;
            });
            for (const [folder, relative] of [
              ["nested", "nested/"],
              ["deep", "nested/deep/"],
            ]) {
              await page
                .locator(name === "ledger" ? "[data-entry] a" : "[data-cw-entry] a")
                .filter({ hasText: folder })
                .first()
                .click();
              await expect(page).toHaveURL(base + route(relative.replace(/\/$/, "")));
              await expect
                .poll(() => page.locator('head link[rel="icon"]').first().getAttribute("href"))
                .toMatch(/^http:/);
              expect(await page.evaluate(() => window.faviconNavigationMarker)).toBe(true);
              await verifyIcons(page, custom);
            }
            await page.goBack();
            await expect(page).toHaveURL(base + route("nested"));
            await expect(page.getByRole("link", { name: /deep/ }).first()).toBeVisible();
            await verifyIcons(page, custom);
            await page.goForward();
            await expect(page).toHaveURL(base + route("nested/deep"));
            await expect(page.getByRole("link", { name: /note.txt/ }).first()).toBeVisible();
            await verifyIcons(page, custom);
            await page.reload();
            await verifyIcons(page, custom);
            expect(errors).toEqual([]);
            const native = await browser.newContext({ javaScriptEnabled: false });
            try {
              const nativePage = await native.newPage();
              await nativePage.goto(base + route("nested/deep"));
              await verifyIcons(nativePage, custom, false);
            } finally {
              await native.close();
            }
          } finally {
            if (server)
              await new Promise((resolve) => {
                server.close(resolve);
                server.closeAllConnections();
              });
            await rm(root, { recursive: true, force: true });
          }
        });

for (const [name, factory] of [
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
]) {
  test(`${name}: live File icons survive refresh, native pagination and History`, async ({
    page,
    browser,
  }) => {
    const { startExplorerServer } = await import("../../packages/server/dist/node.mjs");
    const root = await mkdtemp(path.join(tmpdir(), "dirwell-favicon-live-"));
    const png = await readFile(new URL("../../docs/public/brand/favicon-32.png", import.meta.url));
    let server;
    try {
      await mkdir(path.join(root, "nested"));
      await writeFile(path.join(root, "one.txt"), "one");
      await writeFile(path.join(root, "two.txt"), "two");
      server = await startExplorerServer({
        root,
        port: 0,
        mountPath: "/files",
        pageSize: 2,
        live: { intervalMs: 50 },
        theme: factory({
          brand: {
            favicon: { source: new File([png], "icon.png"), sizes: "32x32", media: "screen" },
          },
        }),
      });
      await page.goto(server.url + "/files/browse/index.html");
      await expect(page.getByRole("searchbox").first()).toBeEnabled();
      await verifyIcons(page, true);
      await writeFile(path.join(root, "new.txt"), "new");
      await expect(page.getByRole("link", { name: /new.txt/ }).first()).toBeVisible();
      await expect(page.locator('head link[rel="icon"]')).toHaveAttribute("media", "screen");
      await verifyIcons(page, true);
      await page
        .locator(name === "ledger" ? "[data-entry] a" : "[data-cw-entry] a")
        .filter({ hasText: "nested" })
        .first()
        .click();
      await expect(page).toHaveURL(/nested\/index.html$/);
      await verifyIcons(page, true);
      await page.goBack();
      await expect(page.getByRole("link", { name: /new.txt/ }).first()).toBeVisible();
      await verifyIcons(page, true);
      const native = await browser.newContext({ javaScriptEnabled: false });
      try {
        const nativePage = await native.newPage();
        await nativePage.goto(server.url + "/files/browse/index.html");
        await nativePage.getByRole("link", { name: "Next", exact: true }).first().click();
        await expect(nativePage).toHaveURL(/page=2/);
        await verifyIcons(nativePage, true, false);
      } finally {
        await native.close();
      }
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
  test(`${name}: absolute cross-origin HTML base retains icons and offers native recovery`, async ({
    page,
  }) => {
    const root = await mkdtemp(path.join(tmpdir(), "dirwell-favicon-origin-"));
    const sourceDir = path.join(root, "files"),
      outputDir = path.join(root, "out");
    const servers = [];
    try {
      await mkdir(path.join(sourceDir, "nested"), { recursive: true });
      const handler = async (request, response) => {
        try {
          const url = new URL(request.url, "http://test");
          if (!url.pathname.startsWith("/downloads/")) throw new Error("Outside mount");
          const relative = decodeURIComponent(url.pathname.slice("/downloads/".length));
          const file = path.resolve(outputDir, relative || "index.html");
          if (!file.startsWith(outputDir + path.sep)) throw new Error("Outside output");
          const types = {
            ".html": "text/html",
            ".js": "text/javascript",
            ".json": "application/json",
            ".png": "image/png",
          };
          response
            .writeHead(200, {
              "content-type": types[path.extname(file)] ?? "application/octet-stream",
            })
            .end(await readFile(file));
        } catch {
          response.writeHead(404).end();
        }
      };
      for (let i = 0; i < 2; i++) {
        const server = createServer(handler);
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        servers.push(server);
      }
      const origins = servers.map((server) => `http://127.0.0.1:${server.address().port}`);
      await generateExplorer({
        sourceDir,
        outputDir,
        base: origins[1] + "/downloads/",
        urlStrategy: "html-base",
        theme: factory(),
      });
      await page.goto(origins[0] + "/downloads/index.html");
      await expect(page.getByRole("searchbox").first()).toBeEnabled();
      await verifyIcons(page);
      await page
        .locator(name === "ledger" ? "[data-entry] a" : "[data-cw-entry] a")
        .filter({ hasText: "nested" })
        .first()
        .click();
      await expect(page.getByRole("link", { name: "Open folder directly" })).toBeVisible();
      await expect(page).toHaveURL(origins[0] + "/downloads/index.html");
      await verifyIcons(page);
      await page.getByRole("link", { name: "Open folder directly" }).click();
      await expect(page).toHaveURL(origins[1] + "/downloads/nested/index.html");
      await verifyIcons(page);
    } finally {
      for (const server of servers)
        await new Promise((resolve) => {
          server.close(resolve);
          server.closeAllConnections();
        });
      await rm(root, { recursive: true, force: true });
    }
  });
}
