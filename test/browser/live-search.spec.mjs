import { test, expect } from "@playwright/test";
import { mkdtemp, mkdir, writeFile, rm, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { startExplorerServer } from "../../packages/server/dist/node.mjs";
import { createLedgerTheme } from "../../packages/theme-ledger/dist/index.mjs";
import { createCrosswaveTheme } from "../../packages/theme-crosswave/dist/index.mjs";
for (const [name, create] of [
  ["ledger", createLedgerTheme],
  ["crosswave", createCrosswaveTheme],
]) {
  test(`${name}: live archive scope, fresh updates, keyboard and mobile`, async ({ page }) => {
    const root = await mkdtemp(path.join(tmpdir(), "dirwell-search-browser-"));
    let server;
    try {
      await mkdir(path.join(root, "nested"));
      await writeFile(path.join(root, "nested", "日本語 #%.txt"), "test");
      server = await startExplorerServer({
        root,
        port: 0,
        theme: create(name === "crosswave" ? { color: "violet" } : {}),
        files: "media",
        search: { refreshIntervalMs: 1000 },
      });
      await page.goto(server.url + "/browse/");
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      const trigger = page.getByRole("button", { name: "Search archive", exact: true });
      await expect(trigger).toBeEnabled();
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Search archive", exact: true });
      await expect(dialog).toBeVisible();
      if (name === "crosswave") {
        await expect(dialog).toHaveCSS("background-color", "rgb(36, 21, 50)");
        expect((await trigger.boundingBox()).height).toBeGreaterThanOrEqual(44);
      }
      const input = dialog.getByRole("searchbox");
      await expect(input).toBeFocused();
      await input.fill("日本語");
      await expect(dialog.getByRole("link")).toHaveText("nested/日本語 #%.txt");
      await page.route("**/__dirwell/search?**", async (route) => {
        if (new URL(route.request().url()).searchParams.get("q") === "failure")
          await route.fulfill({ status: 503, body: "Search scan budget exceeded" });
        else await route.continue();
      });
      await input.fill("failure");
      await expect(dialog.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
      await page.unroute("**/__dirwell/search?**");
      let oldStarted;
      const started = new Promise((resolve) => (oldStarted = resolve));
      await page.route("**/__dirwell/search?**", async (route) => {
        if (new URL(route.request().url()).searchParams.get("q") !== "old") return route.continue();
        oldStarted();
        await new Promise((resolve) => setTimeout(resolve, 700));
        await route
          .fulfill({
            contentType: "application/json",
            body: JSON.stringify({
              version: 1,
              results: [{ name: "old.txt", path: "old.txt", kind: "file", href: null }],
              truncated: false,
            }),
          })
          .catch(() => {});
      });
      await input.fill("old");
      await started;
      await input.fill("日本語");
      await expect(dialog.getByRole("link")).toHaveText("nested/日本語 #%.txt");
      await page.unroute("**/__dirwell/search?**");

      await input.fill("日本語");
      await expect(dialog.getByRole("link")).toHaveText("nested/日本語 #%.txt");

      await writeFile(path.join(root, "new.txt"), "new");
      await input.fill("new");
      await expect(dialog.getByRole("link")).toHaveText("new.txt");
      await rename(path.join(root, "new.txt"), path.join(root, "renamed.txt"));
      await expect(dialog.getByRole("link")).toHaveCount(0);
      await input.fill("renamed");
      await expect(dialog.getByRole("link")).toHaveText("renamed.txt");
      await rm(path.join(root, "renamed.txt"));
      await expect(dialog.getByRole("link")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      await page.setViewportSize({ width: 390, height: 844 });
      await trigger.click();
      await input.fill("日本語");
      await expect(dialog.getByRole("link")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(errors).toEqual([]);
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
}
