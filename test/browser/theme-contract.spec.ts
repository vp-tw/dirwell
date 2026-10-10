import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  createDefaultTheme,
  createCrosswaveTheme,
  createPlainTheme,
  defaultThemeComponents,
  generateExplorer,
} from "../../src/index.ts";
import { contentTypes } from "../../src/content-types.ts";

async function serve(directory: string) {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      let file = path.resolve(directory, `.${decodeURIComponent(url.pathname)}`);
      if (file !== directory && !file.startsWith(`${directory}${path.sep}`))
        throw new Error("Outside output");
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      response.writeHead(200, {
        "content-type": contentTypes[path.extname(file)] ?? "application/octet-stream",
      });
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("No listener");
  return {
    url: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

for (const mode of ["ssg", "mpa"] as const) {
  test(`${mode}: wrapped Ledger components preserve search, sort, keyboard, appearance and global search`, async ({
    page,
  }) => {
    const temporary = await mkdtemp(path.join(tmpdir(), "dirwell-contract-browser-"));
    const sourceDir = path.join(temporary, "files"),
      outputDir = path.join(temporary, "output");
    await mkdir(path.join(sourceDir, "folder"), { recursive: true });
    for (const name of ["file2.txt", "file10.txt", "other.md", "folder/nested.txt"])
      await writeFile(path.join(sourceDir, name), "sample");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await generateExplorer({
        sourceDir,
        outputDir,
        mode,
        theme: createDefaultTheme({
          project: { name: "Override catalog" },
          virtualizeAfter: 1,
          components: {
            Toolbar: (props) =>
              `<section aria-label="Explorer controls">${defaultThemeComponents.Toolbar(props)}</section>`,
            EntryRow: (props) =>
              defaultThemeComponents.EntryRow(props).replace("<li ", "<li data-custom-row "),
          },
        }),
      });
      // A row override deliberately keeps complete HTML above the virtualization threshold.
      const html = await readFile(path.join(outputDir, "index.html"), "utf8");
      expect(html).not.toContain("&quot;entriesHref&quot;");
      const server = await serve(outputDir);
      try {
        await page.goto(server.url);
        await expect(page.locator("[data-custom-row]")).toHaveCount(4);
        await page.keyboard.press("/");
        await expect(page.getByRole("searchbox", { name: "Search this folder" })).toBeFocused();
        await page.keyboard.type("file10");
        await expect(page.locator("[data-entry]:visible")).toHaveCount(1);
        await expect(page.locator("[data-visible-count]")).toHaveText("1");
        await page.keyboard.press("Escape");
        await expect(page.locator("[data-entry]:visible")).toHaveCount(4);
        await page.getByRole("button", { name: "Sort by name, ascending", exact: true }).click();
        await expect(page.locator("[data-entry]:visible").nth(1)).toHaveAttribute(
          "data-name",
          "other.md",
        );
        await page.getByRole("combobox", { name: "Theme", exact: true }).selectOption("dark");
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        await page.getByRole("button", { name: "Search all files", exact: true }).click();
        await page.getByRole("dialog").getByRole("searchbox").fill("nested");
        await expect(page.locator("[data-global-results] a")).toContainText("nested.txt");
        await page.getByRole("button", { name: "Close search", exact: true }).click();
        await page.getByRole("link", { name: /^folder\// }).click();
        await expect(page).toHaveTitle("folder · Override catalog");
        await page.locator("body").click({ position: { x: 2, y: 2 } });
        await page.keyboard.press("ArrowDown");
        await expect(page.getByRole("link", { name: /^nested\.txt/ })).toBeFocused();
        await page.keyboard.press("Backspace");
        await expect(page).toHaveTitle("Override catalog");
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        );
        expect(errors).toEqual([]);
      } finally {
        await server.close();
      }
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
}

for (const mode of ["ssg", "mpa"] as const) {
  test(`${mode}: Crosswave folder history and Plain native links work across engines`, async ({
    browser,
  }) => {
    const temporary = await mkdtemp(path.join(tmpdir(), "dirwell-theme-engines-"));
    const sourceDir = path.join(temporary, "files");
    await mkdir(path.join(sourceDir, "folder"), { recursive: true });
    await writeFile(path.join(sourceDir, "folder/nested.txt"), "sample");
    try {
      for (const [name, theme] of [
        [
          "crosswave",
          createCrosswaveTheme({ project: { name: "Engine catalog" }, backgroundMotion: false }),
        ],
        ["plain", createPlainTheme({ project: { name: "Engine catalog" } })],
      ] as const) {
        const outputDir = path.join(temporary, name);
        await generateExplorer({ sourceDir, outputDir, mode, theme });
        const server = await serve(outputDir);
        const context = await browser.newContext({
          javaScriptEnabled: name !== "plain",
          viewport: { width: 390, height: 844 },
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await page.goto(server.url);
          await page.getByRole("link", { name: /^folder\// }).click();
          await expect(page).toHaveTitle("folder · Engine catalog");
          await expect(page.getByRole("link", { name: /^nested\.txt/ })).toBeVisible();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(390);
          await page.goBack();
          await expect(page).toHaveTitle("Engine catalog");
          await page.goForward();
          await expect(page).toHaveTitle("folder · Engine catalog");
          expect(errors).toEqual([]);
        } finally {
          await context.close();
          await server.close();
        }
      }
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
}
