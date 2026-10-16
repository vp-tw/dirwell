import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, symlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { test, expect } from "@playwright/test";
import { generateExplorer } from "../../packages/core/dist/index.mjs";
import { createPlainTheme } from "../../packages/theme-plain/dist/index.mjs";
import { createLedgerTheme } from "../../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../../packages/theme-crosswave/dist/index.mjs";

let root, server, url;
test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "dirwell-size-browser-"));
  const sourceDir = path.join(root, "source");
  await mkdir(path.join(sourceDir, "docs"), { recursive: true });
  await writeFile(path.join(sourceDir, "download.bin"), Buffer.alloc(1310720));
  await writeFile(path.join(sourceDir, "empty.txt"), "");
  await symlink("download.bin", path.join(sourceDir, "current.bin"));
  await symlink("missing", path.join(sourceDir, "unavailable.bin"));
  for (const [name, creator] of [
    ["plain", createPlainTheme],
    ["ledger", createLedgerTheme],
    ["crosswave", createCrosswaveTheme],
  ])
    for (const mode of ["ssg", "mpa"])
      for (const exact of ["none", "details"])
        await generateExplorer({
          sourceDir,
          outputDir: path.join(root, name + "-" + mode + (exact === "details" ? "-exact" : "")),
          mode,
          theme: creator({
            ...(name === "crosswave" ? { gamepad: false, backgroundMotion: false } : {}),
            ...(exact === "details" ? { size: { exact } } : {}),
          }),
        });
  server = createServer(async (req, res) => {
    try {
      let file = path.resolve(
        root,
        "." + decodeURIComponent(new URL(req.url, "http://test").pathname),
      );
      if (!file.startsWith(root + path.sep)) throw new Error("Outside");
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      res
        .writeHead(200, {
          "content-type":
            { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" }[
              path.extname(file)
            ] ?? "application/octet-stream",
        })
        .end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  await mkdir(".impeccable/review", { recursive: true });
});
test.afterAll(async () => {
  if (server)
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  if (root) await rm(root, { recursive: true, force: true });
});

for (const theme of ["plain", "ledger", "crosswave"])
  for (const mode of ["ssg", "mpa"])
    test(`${theme} ${mode}: readable defaults, opt-in exact disclosure and narrow layout`, async ({
      page,
      browser,
    }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${url}/${theme}-${mode}/`);
      if (theme !== "plain") await expect(page.getByRole("searchbox").first()).toBeEnabled();
      const row = page
        .locator("li")
        .filter({ has: page.getByRole("link", { name: /^current\.bin/ }) })
        .first();
      await expect(row.locator(".dw-size").first()).toContainText("Target");
      await expect(row.locator(".dw-size").first()).toContainText("Link");
      await expect(row.locator(".dw-size").first()).toContainText("1.25 MiB");
      await expect(page.locator("details.dw-size, .dw-size-exact")).toHaveCount(0);
      expect(errors).toEqual([]);
      if (mode === "ssg")
        await page.screenshot({
          path: `.impeccable/review/size-${theme}-desktop.png`,
          fullPage: true,
        });
      await page.setViewportSize({ width: 320, height: 740 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (mode === "ssg")
        await page.screenshot({
          path: `.impeccable/review/size-${theme}-mobile.png`,
          fullPage: true,
        });
      const context = await browser.newContext({ javaScriptEnabled: false });
      const native = await context.newPage();
      await native.goto(`${url}/${theme}-${mode}/`);
      await expect(native.locator("details.dw-size, .dw-size-exact")).toHaveCount(0);
      await expect(
        native.locator(".dw-size").filter({ hasText: "1.25 MiB" }).first(),
      ).toBeVisible();

      await page.goto(`${url}/${theme}-${mode}-exact/`);
      const size = row.locator("details.dw-size").first();
      await expect(size.locator("summary")).toContainText("Target");
      await expect(size.locator("summary")).toContainText("Link");
      for (const name of [/^empty\.txt/, /^unavailable\.bin/]) {
        const unchanged = page
          .locator("li")
          .filter({ has: page.getByRole("link", { name }) })
          .first();
        await expect(unchanged.locator("details.dw-size, .dw-size-exact")).toHaveCount(0);
      }
      const before = page.url();
      await size.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(size).toHaveAttribute("open", "");
      await expect(size.locator(".dw-size-exact")).toContainText("1,310,720 B");
      expect(page.url()).toBe(before);
      await page.keyboard.press("Space");
      await expect(size).not.toHaveAttribute("open", "");
      expect(errors).toEqual([]);
      await expect(size.locator(".dw-size-exact")).not.toContainText("Link");
      await size.locator("summary").click();
      await expect(size.locator(".dw-size-exact")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await native.goto(`${url}/${theme}-${mode}-exact/`);
      const disclosure = native.locator("details.dw-size").first();
      await disclosure.locator("summary").click();
      await expect(disclosure.locator(".dw-size-exact")).toBeVisible();
      await context.close();
    });

test("Ledger target-size sorting survives shared URLs and reload", async ({ page }) => {
  await page.goto(`${url}/ledger-ssg/`);
  const sort = page.getByRole("combobox", { name: /^Sort/ });
  await expect(sort).toBeEnabled();
  await sort.selectOption("targetSize");
  await expect(page).toHaveURL(/dw.sort=targetSize/);
  await page.reload();
  await expect(sort).toHaveValue("targetSize");
  const ids = await page
    .locator("[data-entry]")
    .evaluateAll((rows) => rows.map((row) => row.dataset.id));
  expect(ids.indexOf("empty.txt")).toBeLessThan(ids.indexOf("current.bin"));
  expect(ids.at(-1)).toBe("unavailable.bin");
});
