import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { generateExplorer } from "../../packages/core/dist/index.mjs";
import { createLedgerTheme } from "../../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../../packages/theme-crosswave/dist/index.mjs";

async function serve(root) {
  const server = createServer(async (request, response) => {
    try {
      let file = path.resolve(
        root,
        `.${decodeURIComponent(new URL(request.url, "http://test").pathname)}`,
      );
      if (!file.startsWith(root + path.sep) && file !== root) throw new Error("Outside output");
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
      response.writeHead(200, {
        "content-type": types[path.extname(file)] ?? "application/octet-stream",
      });
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/`,
    close: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeIdleConnections();
      }),
  };
}

for (const [name, creator] of [
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
]) {
  for (const mode of ["ssg", "mpa"]) {
    test(`${name} ${mode}: native framework state, 1200-file search, history, teardown and no-script pagination`, async ({
      page,
      browser,
    }) => {
      test.setTimeout(60_000);
      const temp = await mkdtemp(path.join(tmpdir(), "dirwell-native-"));
      const sourceDir = path.join(temp, "source"),
        outputDir = path.join(temp, "output");
      let server, nojs;
      try {
        await mkdir(path.join(sourceDir, "docs"), { recursive: true });
        await writeFile(path.join(sourceDir, "docs", "nested.txt"), "nested");
        await Promise.all(
          Array.from({ length: 1200 }, (_, index) =>
            writeFile(
              path.join(sourceDir, `file${String(index).padStart(4, "0")}.txt`),
              index === 1199 ? "larger file content" : "text",
            ),
          ),
        );
        await generateExplorer({
          sourceDir,
          outputDir,
          mode,
          theme: creator({ title: "Sample downloads" }),
          listing: {
            html: { strategy: "paged", pageSize: 100 },
            data: { strategy: "blocks", blockSize: 200 },
          },
        });
        server = await serve(outputDir);
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(server.url);
        await page.evaluate(() => (window.__nativeLifetime = "same component"));
        const search = page.locator("input[type=search]").first(),
          rows = page.locator(name === "ledger" ? "[data-entry]" : "[data-cw-entry]");
        await expect(search).toBeEnabled();
        await search.fill("file1199");
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText("file1199");
        await search.fill("");
        await search.blur();
        await page.keyboard.press("End");
        await expect
          .poll(() => page.evaluate(() => document.activeElement.textContent))
          .toMatch(/file1199/);
        if (name === "ledger") expect(await rows.count()).toBeLessThan(50);
        if (name === "ledger") {
          await page.locator(".toolbar select").nth(0).selectOption("size");
          await page.locator(".toolbar select").nth(2).selectOption("desc");
          await page.getByRole("checkbox", { name: "Folders first" }).uncheck();
          await page.getByRole("checkbox", { name: "Folders first" }).blur();
          await page.keyboard.press("Home");
          await expect(rows.first()).toContainText("file1199");
          await page.locator(".toolbar select").nth(0).selectOption("name");
          await page.locator(".toolbar select").nth(2).selectOption("asc");
          await page.getByRole("checkbox", { name: "Folders first" }).check();
          await page.getByRole("button", { name: "Search archive", exact: true }).click();
          const dialog = page.getByRole("dialog");
          await dialog.getByRole("searchbox", { name: "Search archive files" }).fill("nsttxt");
          await expect(dialog.getByRole("link")).toContainText("docs/nested.txt");
          await dialog.getByRole("button", { name: "Close", exact: true }).click();
          await page
            .getByRole("button")
            .filter({ has: page.locator("time") })
            .first()
            .click();
          await expect(page.getByRole("dialog")).toContainText("Modified time");
          await page
            .getByRole("dialog")
            .getByRole("button", { name: "Close", exact: true })
            .click();
        }
        await page.keyboard.press("Home");
        await rows
          .filter({ hasText: /docs\// })
          .getByRole("link")
          .click();
        await expect(page).toHaveURL(/docs/);
        await expect(rows).toHaveCount(1);
        await page.keyboard.press("Backspace");
        await expect(page).toHaveURL(server.url);
        await expect(search).toBeEnabled();
        await page.goBack();
        await expect(page).toHaveURL(/docs/);
        await expect(rows).toHaveCount(1);
        await page.goForward();
        await expect(page).toHaveURL(server.url);
        await expect(search).toBeEnabled();
        expect(await page.evaluate(() => window.__nativeLifetime)).toBe("same component");
        await page.evaluate(() => globalThis.__dirwellUnmount());
        expect(errors).toEqual([]);
        nojs = await browser.newContext({ javaScriptEnabled: false });
        const native = await nojs.newPage();
        await native.goto(server.url);
        const nativeRows = native.locator(name === "ledger" ? "[data-entry]" : "[data-cw-entry]");
        await expect(nativeRows).toHaveCount(100);
        const firstId = await nativeRows.first().getAttribute("data-id");
        await native.getByRole("link", { name: "Next", exact: true }).click();
        await expect(nativeRows).toHaveCount(100);
        expect(await nativeRows.first().getAttribute("data-id")).not.toBe(firstId);
      } finally {
        await nojs?.close();
        await server?.close();
        await rm(temp, { recursive: true, force: true });
      }
    });
  }
}

// Exercise VueUse's real RAF polling with a simulated standard Gamepad interface.
test("Vue Crosswave: preconnected/held controller, deadzone, category, disconnect and denied API", async ({
  page,
}) => {
  test.setTimeout(30_000);
  const temp = await mkdtemp(path.join(tmpdir(), "dirwell-vue-pad-"));
  let server;
  try {
    const sourceDir = path.join(temp, "source"),
      outputDir = path.join(temp, "output");
    await mkdir(sourceDir);
    await writeFile(path.join(sourceDir, "one.txt"), "one");
    await generateExplorer({ sourceDir, outputDir, theme: createCrosswaveTheme() });
    server = await serve(outputDir);
    await page.addInitScript(() => {
      window.__pads = [
        {
          id: "Simulated controller",
          index: 0,
          connected: true,
          mapping: "standard",
          axes: [0, 0],
          buttons: Array.from({ length: 17 }, (_, index) => ({
            pressed: index === 0,
            touched: false,
            value: index === 0 ? 1 : 0,
          })),
        },
      ];
      window.__padDenied = false;
      Object.defineProperty(navigator, "getGamepads", {
        value: () => {
          if (window.__padDenied) throw new DOMException("Denied", "SecurityError");
          return window.__pads;
        },
      });
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(server.url);
    await expect(page.locator(".cw-controller")).toBeVisible();
    await page.waitForTimeout(250);
    expect(page.context().pages()).toHaveLength(1);
    await page.evaluate(() => {
      window.__pads[0].buttons[0].pressed = false;
      window.__pads[0].buttons[0].value = 0;
      window.__pads[0].axes[0] = 0.2;
    });
    await page.waitForTimeout(250);
    await expect(page.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
    await page.evaluate(() => (window.__pads[0].axes[0] = 0.8));
    await expect(page.getByRole("tab").first()).toHaveAttribute("aria-selected", "false");
    await page.evaluate(() => {
      window.__pads = [];
    });
    await expect(page.locator(".cw-controller")).toHaveCount(0);
    await page.evaluate(() => (window.__padDenied = true));
    await page.waitForTimeout(150);
    expect(errors).toEqual([]);
    await page.evaluate(() => globalThis.__dirwellUnmount());
  } finally {
    await server?.close();
    await rm(temp, { recursive: true, force: true });
  }
});

for (const [name, creator] of [
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
]) {
  test(`${name}: live server revisions update framework rows without replacing the document`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const { startExplorerServer } = await import("../../packages/server/dist/node.mjs");
    const root = await mkdtemp(path.join(tmpdir(), "dirwell-live-browser-"));
    let server;
    try {
      await mkdir(path.join(root, "docs"));
      await writeFile(path.join(root, "docs", "nested.txt"), "nested");
      await Promise.all(
        Array.from({ length: 250 }, (_, index) =>
          writeFile(path.join(root, `file${index}.txt`), "text"),
        ),
      );
      server = await startExplorerServer({
        root,
        theme: creator(),
        mountPath: "/catalog",
        pageSize: 20,
        blockSize: 50,
        live: { intervalMs: 50 },
        headers: () => ({ "cache-control": "public, max-age=3600" }),
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(server.url + "/catalog/browse/");
      const search = page.locator("input[type=search]").first(),
        rows = page.locator(name === "ledger" ? "[data-entry]" : "[data-cw-entry]");
      await expect(search).toBeEnabled();
      await page.evaluate(() => (window.__nativeLifetime = "live framework"));
      await search.fill("arrived");
      await expect(rows).toHaveCount(0);
      await search.evaluate((input) => {
        window.__disabledDuringLive = false;
        const observer = new MutationObserver(() => {
          if (input.disabled) window.__disabledDuringLive = true;
        });
        observer.observe(input, { attributes: true, attributeFilter: ["disabled"] });
      });
      // Simulate a page response from just before the manifest's next revision.
      const dataHref = await page.evaluate(() => history.state.dataHref);
      let stalePage = false;
      await page.route(dataHref, async (route) => {
        const response = await route.fetch();
        const data = await response.json();
        if (!stalePage && data.total === 252) {
          stalePage = true;
          if (name === "ledger") data.total = 251;
          else data.listingRevision = "previous-revision";
        }
        await route.fulfill({ response, json: data });
      });
      await writeFile(path.join(root, "arrived.txt"), "new");
      await expect(rows).toHaveCount(1, { timeout: 15_000 });
      await expect(search).toHaveValue("arrived");
      expect(await page.evaluate(() => window.__disabledDuringLive)).toBe(false);
      expect(stalePage).toBe(true);
      await rm(path.join(root, "arrived.txt"));
      await expect(rows).toHaveCount(0);
      await search.fill("");
      await rows
        .filter({ hasText: /docs\// })
        .getByRole("link")
        .click();
      await expect(page).toHaveURL(/docs/);
      await expect(rows).toHaveCount(1);
      await writeFile(path.join(root, "docs", "live-child.txt"), "child");
      await expect(rows).toHaveCount(2);
      expect(await page.evaluate(() => window.__nativeLifetime)).toBe("live framework");
      expect(errors).toEqual([]);
      await page.evaluate(() => globalThis.__dirwellUnmount());
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
}

for (const [name, creator] of [
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
])
  test(`${name}: opt-in metadata follows framework navigation and History`, async ({ page }) => {
    const { createMetadataProvider, createShareImage } =
      await import("../../packages/share-image/dist/index.mjs");
    const root = await mkdtemp(path.join(tmpdir(), "dirwell-native-metadata-"));
    let server;
    try {
      await mkdir(path.join(root, "files/docs"), { recursive: true });
      await writeFile(path.join(root, "files/docs/note.txt"), "file");
      const image = await createShareImage({
        title: "Sample downloads",
        description: "Archive totals: 1 file",
        theme: name,
      });
      await generateExplorer({
        sourceDir: path.join(root, "files"),
        outputDir: path.join(root, "out"),
        theme: creator(),
        metadata: createMetadataProvider(
          {
            siteName: "Sample downloads",
            siteUrl: "https://example.com/files/",
            image: { source: image, outputPath: "__dirwell/metadata/cover.png" },
          },
          { siteName: "Sample downloads", repositoryName: "" },
        ),
      });
      for (const file of await readdir(path.join(root, "out"), { recursive: true })) {
        if (!file.endsWith(".json")) continue;
        const filename = path.join(root, "out", file);
        const snapshot = JSON.parse(await readFile(filename, "utf8"));
        if (snapshot.theme !== name || snapshot.path !== "docs") continue;
        snapshot.metadataHead +=
          '<script data-dirwell-metadata>window.__metadataInjected=true</script><img src="/unexpected-metadata-resource"><meta data-dirwell-metadata http-equiv="refresh" content="0;url=/unexpected"><link data-dirwell-metadata rel="canonical" href="javascript:alert(1)">';
        await writeFile(filename, JSON.stringify(snapshot));
      }
      let unsafeRequests = 0;
      page.on("request", (request) => {
        if (request.url().includes("unexpected-metadata-resource")) unsafeRequests++;
      });
      server = await serve(path.join(root, "out"));
      await page.goto(server.url);
      await page.getByRole("link", { name: /docs/ }).first().click();
      await expect(page).toHaveURL(/\/docs\//);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        "docs · Sample downloads",
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        /Browse docs.*This folder: 1 file/,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        "https://example.com/files/docs/",
      );
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        "https://example.com/files/__dirwell/metadata/cover.png",
      );
      await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
        "content",
        "docs · Sample downloads",
      );
      expect(await page.evaluate(() => window.__metadataInjected)).toBeUndefined();
      expect(unsafeRequests).toBe(0);
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
      await expect(page.locator('meta[http-equiv="refresh"]')).toHaveCount(0);
      await page.getByRole("link", { name: "Home", exact: true }).click();
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        "Sample downloads",
      );
      await page.goBack();
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        "docs · Sample downloads",
      );
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
