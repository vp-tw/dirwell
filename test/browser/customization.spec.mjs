import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, utimes } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { test, expect } from "@playwright/test";
import { generateExplorer } from "../../packages/core/dist/index.mjs";
import { createLedgerTheme } from "../../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../../packages/theme-crosswave/dist/index.mjs";

async function serve(root) {
  const server = createServer(async (req, res) => {
    try {
      let filename = path.resolve(
        root,
        "." + decodeURIComponent(new URL(req.url, "http://test").pathname),
      );
      if (filename !== root && !filename.startsWith(root + path.sep)) throw new Error("Outside");
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, "index.html");
      const types = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".json": "application/json",
        ".png": "image/png",
      };
      res
        .writeHead(200, {
          "content-type": types[path.extname(filename)] ?? "application/octet-stream",
        })
        .end(await readFile(filename));
    } catch {
      res.writeHead(404).end();
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
])
  test(`${name}: translated branding, data columns, independent actions and native fallback`, async ({
    page,
    browser,
  }) => {
    const root = await mkdtemp(path.join(tmpdir(), "dirwell-custom-ui-"));
    const sourceDir = path.join(root, "files"),
      outputDir = path.join(root, "out");
    await mkdir(path.join(sourceDir, "docs"), { recursive: true });
    await writeFile(path.join(sourceDir, "note.txt"), "public fixture");
    await writeFile(path.join(sourceDir, "docs/nested.txt"), "nested");
    await writeFile(
      path.join(sourceDir, "logo.png"),
      await readFile(new URL("../../docs/public/brand/favicon-48.png", import.meta.url)),
    );
    await utimes(
      path.join(sourceDir, "note.txt"),
      new Date("2026-10-13T16:15:00Z"),
      new Date("2026-10-13T16:15:00Z"),
    );
    let server;
    try {
      const options = {
        language: "zh-TW",
        locale: "zh-TW",
        timeZone: "Asia/Taipei",
        brand: { name: "Sample archive", logoUrl: "/logo.png", footerText: "Sample owner" },
        columns: ["name", { dataKey: "description", label: "說明" }, "modified"],
        actions: ["copy-link", "copy-path", "download"],
        labels: {
          searchDirectory: "搜尋目錄",
          search: "搜尋",
          home: "首頁",
          copyLink: "複製連結",
          copyPath: "複製路徑",
          download: "下載",
          copied: "已複製。",
          copyError: "無法複製。",
          retry: "重試",
          close: "關閉",
          modifiedTime: "修改時間",
        },
        ...(name === "ledger"
          ? { archiveSearch: false }
          : {
              categories: [{ id: "everything", label: "全部", icon: "all", match: "all" }],
              backgroundMotion: false,
              gamepad: false,
            }),
      };
      await generateExplorer({
        sourceDir,
        outputDir,
        theme: creator(options),
        entryData: async (entry) => ({
          description: entry.id === "note.txt" ? "Release notes" : "Sample file",
        }),
        listing: { html: { strategy: "paged", pageSize: 100 }, data: { strategy: "all" } },
      });
      server = await serve(outputDir);
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
          value: {
            writeText: async (value) => {
              window.__copied = value;
            },
          },
        });
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(server.url);
      const search = page.getByRole("searchbox").first();
      await expect(search).toBeEnabled();
      await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
      await expect(page.getByText("Sample owner", { exact: true })).toBeVisible();
      if (name === "crosswave") {
        await expect(page.getByRole("tab", { name: /全部/ })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(page.getByRole("tabpanel")).toHaveAttribute(
          "aria-labelledby",
          "cw-tab-everything",
        );
      }
      await search.fill("note");
      const row = page
        .locator(name === "ledger" ? "[data-entry]" : "[data-cw-entry]")
        .filter({ hasText: "note.txt" });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("Release notes");
      const expected = new Intl.DateTimeFormat("zh-TW", {
        timeZone: "Asia/Taipei",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date("2026-10-13T16:15:00Z"));
      await expect(row).toContainText(expected);
      await row.getByRole("button", { name: "複製連結: note.txt", exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.__copied)).toBe(server.url + "note.txt");
      expect(page.url()).toBe(server.url);
      await row.getByRole("button", { name: "複製路徑: note.txt", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect.poll(() => page.evaluate(() => window.__copied)).toBe("note.txt");
      expect(page.url()).toBe(server.url);
      await page.evaluate(() => {
        navigator.clipboard.writeText = async () => {
          throw new Error("denied");
        };
      });
      await row.getByRole("button", { name: "複製連結: note.txt", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "無法複製。" })).toBeVisible();
      await expect(row.locator("a a,a button")).toHaveCount(0);
      const downloadPromise = page.waitForEvent("download");
      await row.getByRole("link", { name: "下載", exact: true }).click();
      expect((await downloadPromise).suggestedFilename()).toBe("note.txt");
      for (const [width, height, label] of [
        [1280, 800, "desktop"],
        [390, 844, "mobile"],
      ]) {
        await page.setViewportSize({ width, height });
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
          .toBe(true);
        await page.screenshot({
          path: `/tmp/dirwell-customization-${name}-${label}.png`,
          fullPage: false,
        });
      }
      await search.fill("docs");
      await page.getByRole("link", { name: /^docs\// }).click();
      await expect(page).toHaveURL(/\/docs\/$/);
      await expect(page.getByText("Sample owner", { exact: true })).toBeVisible();
      await expect(
        page.locator(name === "ledger" ? "[data-entry]" : "[data-cw-entry]"),
      ).toContainText("Sample file");
      expect(errors).toEqual([]);
      const native = await browser.newContext({ javaScriptEnabled: false });
      try {
        const np = await native.newPage();
        await np.goto(server.url);
        await expect(np.getByRole("link", { name: "下載", exact: true }).first()).toBeVisible();
        expect(await np.locator("a a,a button").count()).toBe(0);
      } finally {
        await native.close();
      }
    } finally {
      await page.goto("about:blank").catch(() => {});
      if (server) await server.close();
      await rm(root, { recursive: true, force: true });
    }
  });
