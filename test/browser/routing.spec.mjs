import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { generateExplorer } from "../../packages/core/dist/index.mjs";
import { createPlainTheme } from "../../packages/theme-plain/dist/index.mjs";
import { createLedgerTheme } from "../../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../../packages/theme-crosswave/dist/index.mjs";
import { createExplorerHandler } from "../../packages/server/dist/index.mjs";

async function fixture() {
  const temp = await mkdtemp(path.join(tmpdir(), "dirwell-routing-browser-"));
  const sourceDir = path.join(temp, "source"),
    outputDir = path.join(temp, "output");
  await mkdir(path.join(sourceDir, "folder", "nested"), { recursive: true });
  await writeFile(path.join(sourceDir, "readme.txt"), "ROOT");
  await writeFile(path.join(sourceDir, "folder", "note #%.txt"), "DOWNLOAD");
  return { temp, sourceDir, outputDir };
}
async function listen(handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}
function publicChild(style, logical) {
  return logical + (style === "explicit" ? "/index.html" : style === "slash" ? "/" : "");
}
async function staticHost(outputDir, base, style) {
  return listen(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://test").pathname;
      if (!pathname.startsWith(base)) {
        res.writeHead(404).end();
        return;
      }
      const logical = pathname.slice(base.length).split("/").map(decodeURIComponent).join("/");
      // This fixture explicitly models directory-index serving and file-first clean HTML mapping.
      // It is not evidence of any vendor's defaults.
      let file = path.join(outputDir, logical || "index.html");
      if (
        style === "clean" &&
        logical &&
        !logical.endsWith("/") &&
        (await stat(file + ".html")
          .then((s) => s.isFile())
          .catch(() => false))
      )
        file += ".html";
      else if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      const body = await readFile(file),
        ext = path.extname(file);
      res
        .writeHead(200, {
          "content-type":
            ext === ".html"
              ? "text/html; charset=utf-8"
              : ext === ".json"
                ? "application/json"
                : ext === ".js"
                  ? "text/javascript"
                  : ext === ".css"
                    ? "text/css"
                    : "text/plain",
        })
        .end(body);
    } catch {
      res.writeHead(404).end("Missing resource");
    }
  });
}
for (const [themeName, factory] of [
  ["plain", createPlainTheme],
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
])
  for (const style of ["explicit", "slash", "clean"])
    for (const javaScriptEnabled of [false, true])
      for (const base of ["/", "/downloads/"])
        test(`${themeName} ${style} JS=${javaScriptEnabled} base=${base}: native links, reload, History, data and files`, async ({
          browser,
        }) => {
          const f = await fixture();
          let host, context;
          try {
            await generateExplorer({
              sourceDir: f.sourceDir,
              outputDir: f.outputDir,
              theme: factory(),
              routing: { directoryUrls: style },
              listing: {
                html: { strategy: "paged", pageSize: 1 },
                data: { strategy: "blocks", blockSize: 1 },
              },
            });
            host = await staticHost(f.outputDir, base, style);
            context = await browser.newContext({ javaScriptEnabled });
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", (e) => errors.push(e.message));
            const root = host.origin + base + (style === "explicit" ? "index.html" : "");
            await page.goto(root);
            await page.locator('a[href*="folder"]').first().click();
            await expect(page).toHaveURL(host.origin + base + publicChild(style, "folder"));
            await page.locator('a[href*="nested"]').first().click();
            await expect(page).toHaveURL(host.origin + base + publicChild(style, "folder/nested"));
            await page.reload();
            await page.goBack();
            await expect(page).toHaveURL(host.origin + base + publicChild(style, "folder"));
            if (!javaScriptEnabled || themeName === "plain")
              await page.getByRole("link", { name: "Next", exact: true }).first().click();
            const download = page.locator('a[href*="note%20%23%25.txt"]').first();
            await expect(download).toBeVisible();
            const fileUrl = await download.evaluate((a) => a.href);
            expect(await (await page.request.get(fileUrl)).text()).toBe("DOWNLOAD");
            await page.getByRole("link", { name: "Home", exact: true }).first().click();
            await expect(page).toHaveURL(root);
            await page.goBack();
            await expect(download).toBeVisible();
            expect(errors).toEqual([]);
          } finally {
            await context?.close();
            await host?.close();
            await rm(f.temp, { recursive: true, force: true });
          }
        });

test("Plain explicit relative output navigates through file URLs without JavaScript", async ({
  browser,
}) => {
  const f = await fixture();
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    await generateExplorer({
      sourceDir: f.sourceDir,
      outputDir: f.outputDir,
      theme: createPlainTheme(),
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.join(f.outputDir, "index.html")).href);
    await page.locator('a[href*="folder"]').first().click();
    await expect(page).toHaveURL(pathToFileURL(path.join(f.outputDir, "folder/index.html")).href);
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(pathToFileURL(path.join(f.outputDir, "index.html")).href);
    await generateExplorer({
      sourceDir: f.sourceDir,
      outputDir: f.outputDir,
      theme: createPlainTheme(),
      outputName: "files.html",
      listing: { html: { strategy: "paged", pageSize: 1 }, data: { strategy: "all" } },
    });
    await page.goto(pathToFileURL(path.join(f.outputDir, "files.html")).href);
    await page.locator('a[rel="next"]').first().click();
    await expect(page).toHaveURL(/__dirwell-page-[a-f0-9]+-2\.html$/);
    await expect(page.getByRole("link", { name: "readme.txt", exact: true })).toBeVisible();
    await page.locator('a[rel="prev"]').first().click();
    await page.getByRole("link", { name: "folder/", exact: true }).click();
    await expect(page).toHaveURL(pathToFileURL(path.join(f.outputDir, "folder/files.html")).href);
    await page.getByRole("link", { name: "nested/", exact: true }).click();
    await expect(page).toHaveURL(
      pathToFileURL(path.join(f.outputDir, "folder/nested/files.html")).href,
    );
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(pathToFileURL(path.join(f.outputDir, "files.html")).href);
    await generateExplorer({
      sourceDir: f.sourceDir,
      outputDir: f.outputDir,
      theme: createPlainTheme(),
      outputName: (directory) =>
        directory.current.relativePath === "folder" ? null : "files.html",
    });
    await page.goto(pathToFileURL(path.join(f.outputDir, "folder/nested/files.html")).href);
    await expect(page.getByRole("link", { name: "folder", exact: true })).toHaveCount(0);
    await expect(page.locator("nav span").filter({ hasText: /^folder$/ })).toBeVisible();
    await expect(page.locator('a[href="../files.html"]')).toHaveCount(0);
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(pathToFileURL(path.join(f.outputDir, "files.html")).href);
  } finally {
    await context.close();
    await rm(f.temp, { recursive: true, force: true });
  }
});

for (const factory of [createPlainTheme, createLedgerTheme, createCrosswaveTheme])
  for (const directoryUrls of ["explicit", "slash", "clean"])
    test(`live ${factory.name} ${directoryUrls}: canonical routes and client navigation`, async ({
      page,
    }) => {
      const f = await fixture();
      let server;
      try {
        const handler = await createExplorerHandler({
          root: f.sourceDir,
          mountPath: "/downloads",
          theme: factory(),
          routing: { directoryUrls },
          files: "media",
        });
        server = await listen(async (req, res) => {
          const response = await handler(
            new Request("http://fixture" + req.url, { method: req.method }),
          );
          res.writeHead(response.status, Object.fromEntries(response.headers));
          res.end(Buffer.from(await response.arrayBuffer()));
        });
        await page.goto(server.origin + "/downloads/");
        await page.locator('a[href*="folder"]').first().click();
        await expect(page).toHaveURL(
          server.origin + "/downloads/browse/" + publicChild(directoryUrls, "folder"),
        );
        await page.getByRole("link", { name: "Home", exact: true }).first().click();
        await expect(page).toHaveURL(
          server.origin +
            "/downloads/browse" +
            (directoryUrls === "explicit" ? "/index.html" : directoryUrls === "slash" ? "/" : ""),
        );
      } finally {
        await server?.close();
        await rm(f.temp, { recursive: true, force: true });
      }
    });

for (const [name, factory] of [
  ["plain", createPlainTheme],
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
])
  for (const directoryUrls of ["explicit", "slash", "clean"])
    test(`${name} ${directoryUrls}: owned homepage fallback pagination stays explicit`, async ({
      browser,
    }) => {
      const f = await fixture();
      let context, host;
      try {
        await mkdir(path.join(f.sourceDir, "owned"));
        await writeFile(path.join(f.sourceDir, "owned/index.html"), "OWNED");
        for (let i = 0; i < 4; i++)
          await writeFile(path.join(f.sourceDir, "owned", `file-${i}.txt`), `DOWNLOAD_${i}`);
        await generateExplorer({
          sourceDir: f.sourceDir,
          outputDir: f.outputDir,
          theme: factory(),
          routing: { directoryUrls },
          listing: {
            html: { strategy: "paged", pageSize: 2 },
            data: { strategy: "blocks", blockSize: 2 },
          },
        });
        host = await staticHost(f.outputDir, "/downloads/", directoryUrls);
        context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await page.goto(host.origin + "/downloads/owned/_dirwell.html");
        await page.locator('a[rel="next"]').first().click();
        await expect(page).toHaveURL(/\/owned\/__dirwell-page-[a-f0-9]+-2\.html$/);
        const download = page.locator('a[href*="file-2.txt"]').first();
        await expect(download).toBeVisible();
        const href = await download.evaluate((a) => a.href);
        expect(await (await page.request.get(href)).text()).toBe("DOWNLOAD_2");
        expect(
          await (await page.request.get(host.origin + "/downloads/owned/index.html")).text(),
        ).toBe("OWNED");
      } finally {
        await context?.close();
        await host?.close();
        await rm(f.temp, { recursive: true, force: true });
      }
    });
