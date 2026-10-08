import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createExplorerDevServer } from "../../src/dev-server.ts";
import { internationalTheme } from "../../examples/i18n/theme.ts";

for (const mode of ["ssg", "mpa"] as const) {
  test.describe(`i18n ${mode}`, () => {
    let root: string;
    let server: Awaited<ReturnType<typeof createExplorerDevServer>>;
    test.use({ timezoneId: "Asia/Taipei" });
    test.beforeAll(async () => {
      root = await mkdtemp(path.join(tmpdir(), "dirwell-i18n-browser-"));
      const sourceDir = path.join(root, "files");
      await mkdir(path.join(sourceDir, "docs"), { recursive: true });
      await mkdir(path.join(sourceDir, "empty"));
      await writeFile(path.join(sourceDir, "note.txt"), "sample");
      await writeFile(path.join(sourceDir, "docs/guide.md"), "guide");
      await utimes(
        path.join(sourceDir, "note.txt"),
        new Date("2026-10-08T07:20:00Z"),
        new Date("2026-10-08T07:20:00Z"),
      );
      server = await createExplorerDevServer({
        sourceDir,
        outputDir: path.join(root, "output"),
        mode,
        theme: internationalTheme,
        port: 0,
        host: "127.0.0.1",
      });
    });
    test.afterAll(async () => {
      await server.close();
      await rm(root, { recursive: true, force: true });
    });

    test("switches complete interface languages and persists across navigation", async ({
      page,
    }) => {
      await page.goto(server.url);
      const originalHref = await page.getByRole("link", { name: "note.txt" }).getAttribute("href");
      await expect(page.getByRole("heading", { name: "Files", exact: true })).toBeVisible();
      await page.getByLabel("Language", { exact: true }).selectOption("zh-TW");
      await expect(page.locator("html")).toHaveAttribute("lang", "zh-TW");
      await expect(page.getByRole("heading", { name: "檔案", exact: true })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "位置" })).toBeVisible();
      await expect(page.locator("[data-entry-count]")).toHaveText("3 個項目");
      await expect(page.getByRole("status")).toHaveText("語言已切換為繁體中文。");
      await expect(page.getByRole("link", { name: "note.txt" })).toHaveAttribute(
        "href",
        originalHref!,
      );
      await expect(
        page
          .locator("li")
          .filter({ has: page.getByRole("link", { name: "note.txt" }) })
          .locator("time"),
      ).toContainText("2026年10月8日");
      await page.getByRole("link", { name: "docs/", exact: true }).click();
      await expect(page.getByLabel("語言", { exact: true })).toHaveValue("zh-TW");
      await expect(page.locator("[data-entry-count]")).toHaveText("1 個項目");
      await page.getByLabel("語言", { exact: true }).selectOption("ja");
      await expect(page.getByRole("heading", { name: "ファイル", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "親ディレクトリ" })).toBeVisible();
      await expect(page).toHaveTitle("ファイル · docs");
      await page.getByRole("link", { name: "親ディレクトリ" }).click();
      await expect(page.getByLabel("言語", { exact: true })).toHaveValue("ja");
      await page.getByRole("link", { name: "empty/", exact: true }).click();
      await expect(page.getByText("このディレクトリは空です。")).toBeVisible();
      await page.getByLabel("言語", { exact: true }).selectOption("en");
      await expect(page.getByRole("heading", { name: "Files", exact: true })).toBeVisible();
      await expect(page.locator("[data-entry-count]")).toHaveText("0 entries");
    });

    test("storage denial keeps switching usable and the mobile layout contained", async ({
      page,
    }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new Error("Storage denied");
          },
        });
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(server.url);
      await page.getByLabel("Language", { exact: true }).selectOption("ja");
      await expect(page.getByRole("heading", { name: "ファイル", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.getByLabel("言語", { exact: true }).focus();
      await expect(page.getByLabel("言語", { exact: true })).toBeFocused();
      if (process.env.CAPTURE_I18N && mode === "ssg") {
        await page.screenshot({
          path: path.resolve(".impeccable/review/i18n-mobile-ja.png"),
          fullPage: true,
        });
        await page.setViewportSize({ width: 1440, height: 900 });
        for (const language of ["en", "zh-TW", "ja"]) {
          await page.locator("#language").selectOption(language);
          await page.screenshot({
            path: path.resolve(`.impeccable/review/i18n-desktop-${language}.png`),
            fullPage: true,
          });
        }
      }
    });

    test("without JavaScript the full English listing remains navigable with UTC dates", async ({
      browser,
    }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      try {
        const page = await context.newPage();
        await page.goto(server.url);
        await expect(page.getByRole("heading", { name: "Files", exact: true })).toBeVisible();
        await expect(page.locator("#language")).toBeHidden();
        await expect(
          page
            .locator("li")
            .filter({ has: page.getByRole("link", { name: "note.txt" }) })
            .locator("time"),
        ).toHaveText("2026-10-08 07:20 UTC");
        await page.getByRole("link", { name: "docs/", exact: true }).click();
        await expect(page.getByRole("link", { name: "guide.md" })).toBeVisible();
      } finally {
        await context.close();
      }
    });
  });
}
