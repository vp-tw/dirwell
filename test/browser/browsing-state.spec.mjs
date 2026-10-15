import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { generateExplorer } from "../../packages/core/dist/index.mjs";
import { startExplorerServer } from "../../packages/server/dist/node.mjs";
import { createLedgerTheme } from "../../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../../packages/theme-crosswave/dist/index.mjs";
async function serve(root) {
  const server = createServer(async (request, response) => {
    try {
      let filename = path.resolve(
        root,
        "." + decodeURIComponent(new URL(request.url, "http://test").pathname),
      );
      if (filename !== root && !filename.startsWith(root + path.sep)) throw new Error("Outside");
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, "index.html");
      response.setHeader(
        "content-type",
        path.extname(filename) === ".js"
          ? "text/javascript"
          : path.extname(filename) === ".json"
            ? "application/json"
            : "text/html",
      );
      response.end(await readFile(filename));
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
        server.closeAllConnections();
      }),
  };
}
for (const [name, creator] of [
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
]) {
  for (const mode of ["ssg", "mpa", "live"]) {
    test(`${name} ${mode}: shareable controls, history selection, refresh and failed-target retry`, async ({
      page,
      browser,
    }) => {
      const root = await mkdtemp(path.join(tmpdir(), "dirwell-view-"));
      const sourceDir = path.join(root, "files"),
        outputDir = path.join(root, "out");
      let server, fresh;
      const folder = "docs #50% Á";
      try {
        await mkdir(path.join(sourceDir, folder), { recursive: true });
        await mkdir(path.join(sourceDir, "beta"));
        await writeFile(path.join(sourceDir, "beta/b.txt"), "beta");
        await writeFile(path.join(sourceDir, folder, "nested.txt"), "nested");
        await writeFile(path.join(sourceDir, "hello.txt"), "hello");
        const theme = creator(
          name === "ledger"
            ? { archiveSearch: false }
            : { gamepad: false, backgroundMotion: false },
        );
        if (mode === "live") {
          server = await startExplorerServer({ root: sourceDir, theme, live: { intervalMs: 50 } });
        } else {
          await generateExplorer({
            sourceDir,
            outputDir,
            theme,
            mode,
            listing: { html: { strategy: "all" }, data: { strategy: "blocks", blockSize: 1 } },
          });
          server = await serve(outputDir);
        }
        const url = server.url + (mode === "live" ? "/browse/index.html" : "");
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(url);
        const search = page.getByRole("searchbox").first();
        const rows = page.locator(name === "ledger" ? "[data-entry]" : "[data-cw-entry]");
        await expect(search).toBeEnabled();
        if (name === "crosswave") await page.getByRole("tab", { name: /^Folders/ }).click();
        await search.fill("docs");
        await expect.poll(() => new URL(page.url()).searchParams.get("dw.q")).toBe("docs");
        const parentView = page.url();
        const link = rows.filter({ hasText: "docs" }).getByRole("link").first();
        await link.click();
        await expect(search).toHaveValue("");
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText("nested.txt");
        await search.fill("nested");
        await expect.poll(() => new URL(page.url()).searchParams.get("dw.q")).toBe("nested");
        const childView = page.url();
        await page.goBack();
        await expect(search).toHaveValue("docs");
        await expect(page).toHaveURL(parentView);
        await expect(rows).toHaveCount(1);
        await expect
          .poll(() => page.evaluate(() => document.activeElement?.textContent))
          .toMatch(/docs/);
        if (name === "crosswave")
          await expect(page.getByRole("tab", { name: /^Folders/ })).toHaveAttribute(
            "aria-selected",
            "true",
          );
        await page.goForward();
        await expect(search).toHaveValue("nested");
        await expect(page).toHaveURL(childView);
        await page.reload();
        await expect(search).toBeEnabled();
        await expect(search).toHaveValue("nested");
        fresh = await browser.newContext();
        const shared = await fresh.newPage();
        await shared.goto(parentView);
        await expect(shared.getByRole("searchbox").first()).toBeEnabled();
        await expect(shared.getByRole("searchbox").first()).toHaveValue("docs");
        await expect(
          shared.locator(name === "ledger" ? "[data-entry]" : "[data-cw-entry]"),
        ).toHaveCount(1);
        const controls = new URL(url);
        controls.searchParams.set("dw.q", "hello");
        controls.searchParams.set("host", "keep");
        if (name === "ledger") {
          controls.searchParams.set("dw.sort", "size:desc:unicode:mixed");
          controls.searchParams.set("dw.types", "file");
        } else controls.searchParams.set("dw.category", "document");
        await shared.goto(controls.href);
        await expect(shared.getByRole("searchbox").first()).toBeEnabled();
        await expect(shared.getByRole("searchbox").first()).toHaveValue("hello");
        await expect(
          shared.locator(name === "ledger" ? "[data-entry]" : "[data-cw-entry]"),
        ).toHaveCount(1);
        if (name === "ledger") {
          await expect(shared.locator(".toolbar select").nth(0)).toHaveValue("size");
          await expect(shared.locator(".toolbar select").nth(1)).toHaveValue("unicode");
          await expect(shared.locator(".toolbar select").nth(2)).toHaveValue("desc");
          await expect(shared.getByRole("checkbox", { name: "Folders first" })).not.toBeChecked();
          await expect(
            shared.getByRole("checkbox", { name: "directory", exact: true }),
          ).not.toBeChecked();
        } else
          await expect(shared.getByRole("tab", { name: /^Documents/ })).toHaveAttribute(
            "aria-selected",
            "true",
          );
        expect(new URL(shared.url()).searchParams.get("host")).toBe("keep");
        await fresh.close();
        fresh = null;
        await page.goto(url);
        await expect(search).toBeEnabled();
        const dataHref = await page.evaluate(() => {
          const model = JSON.parse(document.querySelector("#dirwell-page-data").textContent);
          return new URL(
            model.entries.find((entry) => entry.name.startsWith("docs")).presentation
              .folderDataHref,
            document.baseURI,
          ).href;
        });
        let fail = true;
        await page.route(dataHref, (route) =>
          fail ? route.fulfill({ status: 503, body: "try later" }) : route.continue(),
        );
        await rows.filter({ hasText: "docs" }).getByRole("link").first().click();
        await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(new URL(url).pathname);
        await expect(rows.filter({ hasText: "hello.txt" })).toHaveCount(1);
        await expect(
          page.getByRole("link", { name: "Open folder directly", exact: true }),
        ).toHaveAttribute("href", /docs/);
        fail = false;
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText("nested.txt");
        await expect(page).toHaveURL(/docs/);
        await expect(page.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
        await page.goto(url);
        await expect(search).toBeEnabled();
        await page.unroute(dataHref);
        const corruptions = [
          (model) => {
            model.sort = null;
          },
          (model) => {
            model.page = { number: 2, count: 1, offset: 0, total: model.total };
          },
          ...(name === "crosswave"
            ? [
                (model) => {
                  model.categories = [];
                },
              ]
            : []),
        ];
        for (const corrupt of corruptions) {
          await page.route(dataHref, async (route) => {
            const response = await route.fetch();
            const model = await response.json();
            corrupt(model);
            await route.fulfill({ response, json: model });
          });
          await rows.filter({ hasText: "docs" }).getByRole("link").first().click();
          await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
          expect(new URL(page.url()).pathname).toBe(new URL(url).pathname);
          await expect(rows.filter({ hasText: "hello.txt" })).toHaveCount(1);
          await page.unroute(dataHref);
          await page.getByRole("button", { name: "Retry", exact: true }).click();
          await expect(rows.first()).toContainText("nested.txt");
          await page.goto(url);
          await expect(search).toBeEnabled();
        }
        // A valid page envelope is insufficient when its complete listing cannot load.
        const snapshot = await (await page.request.get(dataHref)).json();
        const targetHref = new URL(
          await rows.filter({ hasText: "docs" }).getByRole("link").first().getAttribute("href"),
          url,
        ).href;
        const baseHref = await page.evaluate(() => document.querySelector("base")?.href ?? null);
        const manifestHref = new URL(snapshot.manifestHref, baseHref ?? targetHref).href;
        await page.route(manifestHref, (route) => route.fulfill({ status: 503, body: "offline" }));
        await rows.filter({ hasText: "docs" }).getByRole("link").first().click();
        await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(new URL(url).pathname);
        await expect(rows.filter({ hasText: "hello.txt" })).toHaveCount(1);
        await page.unroute(manifestHref);
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await expect(rows.first()).toContainText("nested.txt");
        await page.goto(url);
        await expect(search).toBeEnabled();
        let release, began;
        const pending = new Promise((resolve) => {
          release = resolve;
        });
        const observed = new Promise((resolve) => {
          began = resolve;
        });
        await page.route(dataHref, async (route) => {
          began();
          await pending;
          try {
            await route.continue();
          } catch {
            /* Superseded browser request. */
          }
        });
        try {
          await rows.filter({ hasText: "docs" }).getByRole("link").first().click();
          await observed;
          await rows.filter({ hasText: "beta" }).getByRole("link").first().click();
          await expect(rows).toHaveCount(1);
          await expect(rows.first()).toContainText("b.txt");
          release();
          await page.waitForTimeout(100);
          await expect(page).toHaveURL(/beta/);
          await expect(rows.first()).toContainText("b.txt");
        } finally {
          release();
        }
        await page.goto(url);
        await expect(search).toBeEnabled();
        await page.evaluate(() => {
          history.pushState = () => {
            throw new DOMException("denied", "SecurityError");
          };
        });
        await rows.filter({ hasText: "beta" }).getByRole("link").first().click();
        await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(new URL(url).pathname);
        await expect(rows.filter({ hasText: "hello.txt" })).toHaveCount(1);
        expect(errors).toEqual([]);
        await page.goto("about:blank");
      } finally {
        await fresh?.close();
        await server?.close();
        await rm(root, { recursive: true, force: true });
      }
    });
  }
}

test("Crosswave: 10,000 measured long rows, custom actions, scroll coverage and resize", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-window-"));
  const sourceDir = path.join(root, "files"),
    outputDir = path.join(root, "out");
  let server, native;
  try {
    await mkdir(path.join(sourceDir, "artifact-05000-folder"), { recursive: true });
    await writeFile(path.join(sourceDir, "artifact-05000-folder/nested.txt"), "nested");
    for (let start = 0; start < 10000; start += 100)
      await Promise.all(
        Array.from({ length: 100 }, (_, offset) =>
          writeFile(
            path.join(
              sourceDir,
              `artifact-${String(start + offset).padStart(5, "0")}-long-public-release-details-and-notes.txt`,
            ),
            "ok",
          ),
        ),
      );
    await generateExplorer({
      sourceDir,
      outputDir,
      mirror: false,
      sort: { directoriesFirst: false },
      theme: createCrosswaveTheme({
        gamepad: false,
        backgroundMotion: false,
        columns: ["name", { dataKey: "description", label: "Description" }],
        actions: ["download"],
      }),
      entryData: () => ({
        description: "Public release description with a wrapping row and separate action.",
      }),
      listing: {
        html: { strategy: "paged", pageSize: 100 },
        data: { strategy: "blocks", blockSize: 1000 },
      },
    });
    server = await serve(outputDir);
    await page.goto(server.url);
    await expect(page.getByRole("searchbox")).toBeEnabled();
    const rows = page.locator("[data-cw-entry]");
    await expect.poll(() => rows.count()).toBeLessThan(50);
    const pane = page.locator(".cw-list-scroll");
    const cover = async () => {
      const gaps = await pane.evaluate(async (pane) => {
        const problems = [];
        for (const fraction of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
          pane.scrollTop = fraction * (pane.scrollHeight - pane.clientHeight);
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          const boundary = pane.getBoundingClientRect();
          const style = getComputedStyle(pane);
          const contentTop = boundary.top + parseFloat(style.paddingTop);
          const contentBottom = boundary.bottom - parseFloat(style.paddingBottom);
          const visible = [...pane.querySelectorAll("[data-cw-entry]")]
            .map((node) => node.getBoundingClientRect())
            .filter((rect) => rect.bottom > boundary.top && rect.top < boundary.bottom);
          if (
            !visible.length ||
            visible[0].top > contentTop + 1 ||
            visible.at(-1).bottom < contentBottom - 1
          )
            problems.push(fraction);
        }
        return problems;
      });
      expect(gaps).toEqual([]);
      expect(await rows.count()).toBeLessThan(50);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
    };
    await cover();
    await page.setViewportSize({ width: 390, height: 844 });
    await cover();
    await page.screenshot({
      path: test.info().outputPath("crosswave-mobile.png"),
      fullPage: false,
    });
    await page.getByRole("searchbox").blur();
    await page.keyboard.press("End");
    await expect
      .poll(() => page.evaluate(() => document.activeElement.textContent))
      .toContain("artifact-09999");
    await expect(rows.filter({ hasText: "artifact-09999" })).toHaveAttribute(
      "aria-posinset",
      "10001",
    );
    await expect(rows.first()).toHaveAttribute("aria-setsize", "10001");
    await page.keyboard.press("ArrowDown");
    await expect
      .poll(() => page.evaluate(() => document.activeElement.textContent))
      .toContain("artifact-09999");
    await page.keyboard.press("Home");
    await expect
      .poll(() => page.evaluate(() => document.activeElement.textContent))
      .toContain("artifact-00000");
    await page.getByRole("searchbox").fill("09999");
    await expect(rows).toHaveCount(1);
    await page.getByRole("searchbox").fill("");
    await expect.poll(() => rows.count()).toBeLessThan(50);
    await page.setViewportSize({ width: 1280, height: 800 });
    await cover();
    await page.screenshot({
      path: test.info().outputPath("crosswave-desktop.png"),
      fullPage: false,
    });
    await pane.evaluate(async (pane) => {
      for (let fraction = 0.48; fraction < 0.55; fraction += 0.001) {
        pane.scrollTop = fraction * (pane.scrollHeight - pane.clientHeight);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (pane.querySelector('[data-id="artifact-05000-folder"]')) return;
      }
    });
    const folder = rows.filter({ hasText: "artifact-05000-folder" }).getByRole("link").first();
    await folder.scrollIntoViewIfNeeded();
    const beforeFolder = await pane.evaluate((pane) => pane.scrollTop);
    await folder.click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("nested.txt");
    await page.goBack();
    await expect
      .poll(() => page.evaluate(() => document.activeElement.textContent))
      .toContain("artifact-05000-folder");
    await expect.poll(() => pane.evaluate((pane) => pane.scrollTop)).toBeCloseTo(beforeFolder, 0);
    native = await browser.newContext({ javaScriptEnabled: false });
    const fallback = await native.newPage();
    await fallback.goto(server.url);
    await expect(fallback.locator("[data-cw-entry]")).toHaveCount(100);
    await fallback.getByRole("link", { name: "Next", exact: true }).click();
    await expect(fallback.locator("[data-cw-entry]")).toHaveCount(100);
    await page.goto("about:blank");
  } finally {
    await native?.close();
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});

for (const [name, creator] of [
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
]) {
  test(`${name}: a skipped source parent keeps its native Home link`, async ({ page }) => {
    const root = await mkdtemp(path.join(tmpdir(), "dirwell-skipped-"));
    const sourceDir = path.join(root, "files"),
      outputDir = path.join(root, "out");
    let server;
    try {
      await mkdir(path.join(sourceDir, "child"), { recursive: true });
      await writeFile(
        path.join(sourceDir, "index.html"),
        "<!doctype html><title>Source homepage</title><h1>Original source homepage</h1>",
      );
      await writeFile(path.join(sourceDir, "_dirwell.html"), "Existing file");
      await writeFile(path.join(sourceDir, "child/note.txt"), "note");
      await generateExplorer({ sourceDir, outputDir, theme: creator() });
      server = await serve(outputDir);
      await page.goto(server.url + "child/");
      await expect(page.getByRole("searchbox").first()).toBeEnabled();
      await page.getByRole("link", { name: "Home", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Original source homepage" })).toBeVisible();
      await page.goto("about:blank");
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
}

test("Crosswave: RTL category arrows move and focus in visual order", async ({ page }) => {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-rtl-"));
  let server;
  try {
    const sourceDir = path.join(root, "files");
    const outputDir = path.join(root, "out");
    await mkdir(sourceDir);
    await writeFile(path.join(sourceDir, "hello.txt"), "hello");
    await generateExplorer({
      sourceDir,
      outputDir,
      theme: createCrosswaveTheme({ direction: "rtl", gamepad: false, backgroundMotion: false }),
    });
    server = await serve(outputDir);
    await page.goto(server.url);
    await expect(page.getByRole("searchbox")).toBeEnabled();
    const tabs = page.getByRole("tab");
    await tabs.first().focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tabs.nth(1)).toBeFocused();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(tabs.first()).toBeFocused();
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
    await page.goto("about:blank");
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
