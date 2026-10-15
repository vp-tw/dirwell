import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { generateExplorer } from "../../packages/core/dist/index.mjs";
import { createLedgerTheme } from "../../packages/theme-ledger/dist/index.mjs";

let root, server, url;
const longName = "Long filename with spaces and 中文 ".repeat(5) + ".txt";

test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "dirwell-ledger-layout-"));
  const sourceDir = path.join(root, "files"),
    outputDir = path.join(root, "output");
  await mkdir(path.join(sourceDir, "docs"), { recursive: true });
  await writeFile(path.join(sourceDir, "docs", "note.txt"), "nested");
  await writeFile(path.join(sourceDir, longName), "long name");
  await symlink(longName, path.join(sourceDir, "linked.txt"));
  await Promise.all(
    Array.from({ length: 620 }, (_, i) =>
      writeFile(path.join(sourceDir, `file-${String(i).padStart(4, "0")}.txt`), "sample"),
    ),
  );
  await generateExplorer({
    sourceDir,
    outputDir,
    theme: createLedgerTheme({ title: "Sample downloads" }),
    listing: {
      html: { strategy: "paged", pageSize: 100 },
      data: { strategy: "blocks", blockSize: 200 },
    },
  });
  server = createServer(async (request, response) => {
    try {
      let file = path.resolve(
        outputDir,
        "." + decodeURIComponent(new URL(request.url, "http://test").pathname),
      );
      if (file !== outputDir && !file.startsWith(outputDir + path.sep))
        throw new Error("Outside output");
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      response
        .writeHead(200, {
          "content-type":
            { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" }[
              path.extname(file)
            ] ?? "application/octet-stream",
        })
        .end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(async () => {
  if (server)
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  if (root) await rm(root, { recursive: true, force: true });
});

async function ready(page) {
  await page.goto(url);
  await expect(page.getByRole("searchbox").first()).toBeEnabled();
  await expect(page.locator("[data-visible-count]")).toHaveText("623");
}

async function assertSticky(page) {
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect
    .poll(() => page.locator("main > header").evaluate((e) => e.getBoundingClientRect().top))
    .toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.abs(
          document.querySelector(".entry-head").getBoundingClientRect().top -
            document.querySelector("main > header").getBoundingClientRect().bottom,
        ),
      ),
    )
    .toBeLessThanOrEqual(1);
  const geometry = await page.evaluate(() => {
    const header = document.querySelector("main > header").getBoundingClientRect();
    const columns = document.querySelector(".entry-head").getBoundingClientRect();
    const x = columns.left + columns.width / 2;
    return {
      gap: columns.top - header.bottom,
      headerCovers: Boolean(
        document.elementFromPoint(x, header.bottom - 1)?.closest(".page-header"),
      ),
      columnsCover: Boolean(
        document.elementFromPoint(x, header.bottom + 1)?.closest(".entry-head"),
      ),
    };
  });
  expect(Math.abs(geometry.gap)).toBeLessThanOrEqual(1);
  expect(geometry.headerCovers).toBe(true);
  expect(geometry.columnsCover).toBe(true);
}

test("Ledger desktop keeps compact aligned rows and opaque contiguous sticky context", async ({
  page,
}) => {
  await ready(page);
  const geometry = await page
    .locator("[data-entry]")
    .filter({ hasText: "file-0000.txt" })
    .evaluate((row) => {
      const head = document.querySelector(".entry-head");
      return {
        height: row.getBoundingClientRect().height,
        columns: [...row.children].map(
          (e, i) => e.getBoundingClientRect().left - head.children[i].getBoundingClientRect().left,
        ),
      };
    });
  expect(geometry.height).toBeGreaterThanOrEqual(52);
  expect(geometry.height).toBeLessThanOrEqual(54);
  for (const delta of geometry.columns) expect(Math.abs(delta)).toBeLessThanOrEqual(1);
  await assertSticky(page);
  await page.getByRole("searchbox").first().fill("linked.txt");
  await expect(page.locator("[data-entry]")).toHaveCount(1);
  expect(
    await page.locator("[data-entry]").evaluate((e) => e.getBoundingClientRect().height),
  ).toBeGreaterThan(54);
  await expect(page.locator(".target")).toContainText(longName);
});

test("Ledger tracks wrapped header height and falls back when context is too tall", async ({
  page,
}) => {
  await ready(page);
  await page
    .locator(".page-header nav")
    .evaluate((e) => e.append(document.createTextNode(" / nested-directory".repeat(8))));
  await assertSticky(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await page
    .locator(".page-header nav")
    .evaluate((e) => e.append(document.createTextNode(" / nested-directory".repeat(40))));
  await expect(page.locator("main")).toHaveAttribute("data-sticky-header-disabled", "");
  await expect(page.locator("main > header")).toHaveCSS("position", "static");
  await expect(page.locator(".entry-head")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("Ledger narrow long names and metadata remain readable and keyboard rows stay visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await ready(page);
  await page.getByRole("searchbox").first().fill("Long filename");
  await expect(page.locator("[data-entry]")).toHaveCount(2);
  const row = page
    .locator("[data-entry]")
    .filter({ has: page.getByRole("link", { name: longName, exact: true }) });
  expect(
    await row.locator(".name").evaluate((e) => e.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.getByRole("searchbox").first().fill("");
  await page.getByRole("searchbox").first().blur();
  for (const key of ["End", "Home", "ArrowDown"]) {
    await page.keyboard.press(key);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const focused = document.activeElement?.getBoundingClientRect();
          const header = document.querySelector("main > header").getBoundingClientRect();
          return (
            focused && focused.top >= Math.max(0, header.bottom) && focused.bottom <= innerHeight
          );
        }),
      )
      .toBe(true);
  }
});

test("Ledger native HTML retains compact rows and sticky context without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1280, height: 800 },
  });
  try {
    const page = await context.newPage();
    await page.goto(url);
    expect(
      await page
        .locator("[data-entry]")
        .filter({ hasText: "file-0000.txt" })
        .evaluate((e) => e.getBoundingClientRect().height),
    ).toBeLessThanOrEqual(54);
    await page.evaluate(() => window.scrollTo(0, 800));
    await expect
      .poll(() => page.locator(".entry-head").evaluate((e) => e.getBoundingClientRect().top))
      .toBe(0);
    await expect(page.locator("main > header")).toHaveCSS("position", "static");
    await expect(page.getByRole("link", { name: "Next", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Next", exact: true }).click();
    await expect(page.locator("[data-entry]")).toHaveCount(100);
  } finally {
    await context.close();
  }
});
