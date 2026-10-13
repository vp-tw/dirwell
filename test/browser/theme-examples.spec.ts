import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import catppuccinConfig from "../../examples/default-theme-override/config.ts";
import customConfig from "../../examples/custom-theme/config.ts";
import { startExplorerServer } from "@dirwell/server/node";
import { generateExplorer } from "@dirwell/core";

async function serve(directory: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (!pathname.startsWith("/catalog/")) throw new Error("Outside mount");
      const relative = decodeURIComponent(pathname.slice("/catalog/".length));
      let file = path.resolve(directory, relative);
      if (file !== directory && !file.startsWith(`${directory}${path.sep}`)) {
        throw new Error("Outside output");
      }
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      response.writeHead(200, {
        "content-type":
          path.extname(file) === ".json"
            ? "application/json"
            : path.extname(file) === ".svg"
              ? "image/svg+xml"
              : path.extname(file) === ".js"
                ? "text/javascript"
                : "text/html",
      });
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No server port");
  return {
    url: `http://127.0.0.1:${address.port}/catalog/`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test("compiled Ledger wrapper preserves icons, search, appearance and narrow navigation", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const temporary = await mkdtemp(path.join(tmpdir(), "dirwell-catppuccin-browser-"));
  const sourceDir = path.join(temporary, "files");
  await mkdir(sourceDir);
  await mkdir(path.join(sourceDir, "child"));
  await writeFile(path.join(sourceDir, "guide.md"), "Guide");
  await writeFile(path.join(sourceDir, "notes.txt"), "Notes");
  try {
    for (const mode of ["ssg", "mpa"] as const) {
      const outputDir = path.join(temporary, `output-${mode}`);
      await generateExplorer({
        sourceDir,
        outputDir,
        mode,
        base: "/catalog/",
        urlStrategy: "base",
        theme: catppuccinConfig.theme,
      });
      const server = await serve(outputDir);
      try {
        await page.goto(server.url);
        await expect(page.getByRole("heading", { name: "Catppuccin explorer" })).toBeVisible();
        const appearance = page.getByRole("combobox", { name: "Appearance" });
        await appearance.selectOption("light");
        const row = page
          .locator("[data-entry]")
          .filter({ has: page.getByRole("link", { name: "guide.md", exact: true }) });
        await expect(row.locator(".file-icon--light")).toBeVisible();
        await expect(row.locator(".file-icon--dark")).toBeHidden();
        await appearance.selectOption("dark");
        await expect(row.locator(".file-icon--dark")).toBeVisible();
        await expect(row.locator(".file-icon--light")).toBeHidden();
        await page.getByRole("searchbox", { name: "Search this directory" }).fill("guide");
        await expect(row).toBeVisible();
        await expect(page.getByRole("link", { name: "notes.txt", exact: true })).toHaveCount(0);
        await page.getByRole("searchbox", { name: "Search this directory" }).fill("");
        await page.emulateMedia({ colorScheme: "dark" });
        await appearance.selectOption("system");
        await expect(row.locator(".file-icon--dark")).toBeVisible();
        await page.setViewportSize({ width: 320, height: 720 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          320,
        );
        await page.getByRole("link", { name: "child", exact: true }).click();
        await expect(page).toHaveURL(/child\//);
        await expect(page.getByRole("heading", { name: "Catppuccin explorer" })).toBeVisible();
        await page.setViewportSize({ width: 1280, height: 800 });
      } finally {
        await server.close();
      }
    }
    for (let index = 0; index < 501; index++)
      await writeFile(path.join(sourceDir, `file-${index}.txt`), "x");
    const outputDir = path.join(temporary, "virtual");
    await generateExplorer({ sourceDir, outputDir, theme: catppuccinConfig.theme });
    const server = await serve(outputDir);
    try {
      await page.goto(server.url);
      await page.getByRole("combobox", { name: "Appearance" }).selectOption("dark");
      await expect(page.locator("[data-entry] .file-icon--dark").first()).toBeVisible();
      await expect(page.locator("[data-entry]")).toHaveCount(35);
    } finally {
      await server.close();
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("release catalog remains navigable at narrow widths", async ({ page }) => {
  const temporary = await mkdtemp(path.join(tmpdir(), "dirwell-release-catalog-browser-"));
  try {
    await generateExplorer({
      sourceDir: path.resolve(import.meta.dirname, "../../examples/custom-theme/files"),
      outputDir: temporary,
      base: "/catalog/",
      urlStrategy: "base",
      theme: customConfig.theme,
    });
    const server = await serve(temporary);
    try {
      await page.setViewportSize({ width: 320, height: 720 });
      await page.goto(server.url);
      await expect(page.getByRole("heading", { name: "Available files" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
      await page.getByRole("link", { name: "stable/" }).click();
      await expect(page.getByRole("heading", { name: "stable" })).toBeVisible();
    } finally {
      await server.close();
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});

test("compiled Ledger wrapper works in live server mode", async ({ browser }) => {
  const temporary = await mkdtemp(path.join(tmpdir(), "dirwell-catppuccin-server-"));
  await writeFile(path.join(temporary, "guide.md"), "Guide");
  const server = await startExplorerServer({ root: temporary, theme: catppuccinConfig.theme });
  const page = await browser.newPage();
  try {
    await page.goto(server.url + "/browse/");
    await expect(page.locator("[data-entry] .file-icon--light")).toBeVisible();
    await page.getByRole("combobox", { name: "Appearance" }).selectOption("dark");
    await expect(page.locator("[data-entry] .file-icon--dark")).toBeVisible();
  } finally {
    await page.close();
    await server.close();
    await rm(temporary, { recursive: true, force: true });
  }
});
