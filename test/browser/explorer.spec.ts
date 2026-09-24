import { createServer } from "node:http";
import { cp, mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { createExplorerDevServer } from "../../src/dev-server.ts";
import { generateExplorer } from "../../src/generator.ts";

const mount = "/catalog/";
const outputTypes: Readonly<Record<string, string>> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
};

async function serveStatic(
  directory: string,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (!pathname.startsWith(mount)) throw new Error("Outside mount");
      const relative = decodeURIComponent(pathname.slice(mount.length));
      let filePath = path.resolve(directory, relative);
      if (filePath !== directory && !filePath.startsWith(`${directory}${path.sep}`)) {
        throw new Error("Outside output");
      }
      if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
      const contents = await readFile(filePath);
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-type": outputTypes[path.extname(filePath)] ?? "application/octet-stream",
      });
      response.end(contents);
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
    url: `http://127.0.0.1:${address.port}${mount}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function makeSource(directory: string, outsideFile: string): Promise<void> {
  await mkdir(path.join(directory, "docs"), { recursive: true });
  await writeFile(path.join(directory, "README.txt"), "readme\n");
  await writeFile(path.join(directory, "file2.txt"), "aa");
  await writeFile(path.join(directory, "file10.txt"), "aaaaaaaaaa");
  await writeFile(path.join(directory, "notes.md"), "notes\n");
  await writeFile(path.join(directory, "docs", "guide.txt"), "guide\n");
  await symlink("README.txt", path.join(directory, "good-link"));
  await symlink("missing.txt", path.join(directory, "broken-link"));
  await symlink(outsideFile, path.join(directory, "outside-link"));
}

type Mode = "ssg" | "mpa" | "virtual" | "serveSsg" | "serveMpa";
const urls = {} as Record<Mode, string>;
const sourceDirs = {} as Record<"serveSsg" | "serveMpa", string>;
const closeServers: Array<() => Promise<void>> = [];
let temporary = "";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(60_000);
  temporary = await mkdtemp(path.join(tmpdir(), "dirwell-browser-"));
  const outsideFile = path.join(temporary, "outside.txt");
  await writeFile(outsideFile, "outside\n");
  const small = path.join(temporary, "small");
  const large = path.join(temporary, "large");
  await makeSource(small, outsideFile);
  await cp(small, large, { recursive: true });
  for (let start = 0; start < 520; start += 100) {
    await Promise.all(
      Array.from({ length: Math.min(100, 520 - start) }, (_, offset) =>
        writeFile(path.join(large, `file-${String(start + offset).padStart(4, "0")}.txt`), "x"),
      ),
    );
  }
  for (const mode of ["ssg", "mpa", "virtual"] as const) {
    const outputDir = path.join(temporary, `output-${mode}`);
    await generateExplorer({
      sourceDir: mode === "virtual" ? large : small,
      outputDir,
      mode: mode === "ssg" ? "ssg" : "mpa",
      base: mount,
      urlStrategy: mode === "mpa" ? "html-base" : "base",
      symlinks: { follow: true, boundary: "root", onCycle: "skip" },
    });
    const server = await serveStatic(outputDir);
    urls[mode] = server.url;
    closeServers.push(server.close);
  }
  for (const mode of ["serveSsg", "serveMpa"] as const) {
    const sourceDir = path.join(temporary, mode);
    sourceDirs[mode] = sourceDir;
    await makeSource(sourceDir, outsideFile);
    const server = await createExplorerDevServer({
      sourceDir,
      outputDir: path.join(temporary, `output-${mode}`),
      mode: mode === "serveSsg" ? "ssg" : "mpa",
      base: mount,
      urlStrategy: "base",
      symlinks: { follow: true, boundary: "root", onCycle: "skip" },
      port: 0,
    });
    urls[mode] = server.url;
    closeServers.push(server.close);
  }
});

test.afterAll(async () => {
  await Promise.allSettled(closeServers.map((close) => close()));
  if (temporary !== "") await rm(temporary, { recursive: true, force: true });
});

async function assertFilePolicy(page: Page): Promise<void> {
  const readme = page.getByRole("link", { name: "README.txt", exact: true });
  await expect(readme).toHaveAttribute("target", "_blank");
  await expect(readme).toHaveAttribute("rel", "noopener");
  const [popup] = await Promise.all([page.waitForEvent("popup"), readme.click()]);
  await expect(popup).toHaveURL(/\/catalog\/README\.txt$/);
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await expect(popup.locator("body")).toContainText("readme");
  await popup.close();
  await expect(page.locator('[data-name="outside-link"] a')).toHaveCount(0);
  await expect(page.locator('[data-name="outside-link"]')).toContainText("external link");
  await expect(page.locator('[data-name="broken-link"] a')).toHaveAttribute(
    "href",
    /__dirwell\/raw-links\/[a-f0-9]{16}\.txt$/,
  );
}

for (const mode of ["ssg", "mpa"] as const) {
  test(`${mode}: generated fallback page remains reachable beside an existing index`, async ({
    page,
  }) => {
    const sourceDir = path.join(temporary, `fallback-${mode}`);
    const outputDir = path.join(temporary, `fallback-output-${mode}`);
    await mkdir(path.join(sourceDir, "docs"), { recursive: true });
    await writeFile(path.join(sourceDir, "docs", "index.html"), "<h1>Existing document</h1>");
    await writeFile(path.join(sourceDir, "docs", "guide.txt"), "Guide");
    await generateExplorer({ sourceDir, outputDir, mode, base: mount, urlStrategy: "base" });
    const server = await serveStatic(outputDir);
    try {
      await page.goto(server.url);
      await page.getByRole("link", { name: "docs/" }).click();
      await expect(page).toHaveURL(/\/catalog\/docs\/_dirwell\.html$/);
      await expect(page.getByRole("heading", { name: "/docs/" })).toBeVisible();
      await page.getByRole("link", { name: "Home" }).click();
      await expect(page).toHaveURL(/\/catalog\/$/);
      const existing = await page.request.get(new URL("docs/", server.url).href);
      expect(await existing.text()).toContain("Existing document");
    } finally {
      await server.close();
    }
  });

  test(`${mode}: navigation, breadcrumbs, file tabs, and symlink boundaries`, async ({ page }) => {
    await page.goto(urls[mode]);
    await expect(page.getByRole("heading", { name: "/" })).toBeVisible();
    await assertFilePolicy(page);
    await page.getByRole("link", { name: "docs/" }).click();
    await expect(page).toHaveURL(/\/catalog\/docs\/$/);
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("docs");
    await expect(page.locator('[aria-current="page"]')).toHaveText("docs");
    await page.keyboard.press("Backspace");
    await expect(page).toHaveURL(/\/catalog\/$/);
  });

  test(`${mode}: search, type filters, IME-safe shortcuts, and persistence`, async ({ page }) => {
    await page.goto(urls[mode]);
    const search = page.getByRole("searchbox", { name: "Search this folder" });
    await page.keyboard.press("/");
    await expect(search).toBeFocused();
    await search.evaluate((element) => {
      element.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
      (element as HTMLInputElement).value = "file10";
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await expect(page.locator("[data-visible-count]")).toHaveText("8");
    await search.evaluate((element) =>
      element.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })),
    );
    await expect(page.locator("[data-visible-count]")).toHaveText("1");
    await page.getByRole("checkbox", { name: "Files" }).uncheck();
    await expect(page.locator("[data-visible-count]")).toHaveText("0");
    await page.getByRole("checkbox", { name: "Files" }).check();
    await expect(page.locator("[data-visible-count]")).toHaveText("1");
    await page.reload();
    await expect(search).toHaveValue("file10");
    await page.keyboard.press("Escape");
    await expect(search).toHaveValue("");
    await page.evaluate(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "/", isComposing: true, bubbles: true }),
      );
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "/", keyCode: 229, bubbles: true }),
      );
    });
    await expect(search).not.toBeFocused();
  });

  test(`${mode}: sorting, theme persistence, and global search`, async ({ page }) => {
    await page.goto(urls[mode]);
    await page.getByText("Sort", { exact: true }).click();
    await page.locator("[data-sort-direction]").selectOption("desc");
    const names = await page
      .locator("[data-entry-list] [data-entry]")
      .evaluateAll((rows) => rows.map((row) => (row as HTMLElement).dataset.name));
    expect(names.indexOf("file10.txt")).toBeLessThan(names.indexOf("file2.txt"));
    await page.getByRole("combobox", { name: "Theme" }).selectOption("dark");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Search all files" }).click();
    await page
      .getByRole("dialog", { name: "Search all files" })
      .getByRole("searchbox")
      .fill("guide.txt");
    const result = page.locator("[data-global-results] a.name");
    await expect(result).toHaveCount(1);
    await expect(result).toHaveAttribute("href", /\/catalog\/docs\/guide\.txt$/);
    await expect(result).toHaveAttribute("target", "_blank");
  });

  test(`${mode}: keyboard navigation follows visible rows`, async ({ page }) => {
    await page.goto(urls[mode]);
    const rows = page.locator("[data-entry-list] [data-entry]");
    await page.keyboard.press("Home");
    await expect(rows.first().getByRole("link").first()).toBeFocused();
    await page.keyboard.press("j");
    await expect(rows.nth(1).getByRole("link").first()).toBeFocused();
    await page.keyboard.press("k");
    await expect(rows.first().getByRole("link").first()).toBeFocused();
    await page.getByRole("searchbox", { name: "Search this folder" }).fill("file10");
    await page.keyboard.press("Escape");
    await page.keyboard.press("End");
    await expect(rows.last().getByRole("link").first()).toBeFocused();
  });

  test(`${mode}: generated HTML still navigates without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto(urls[mode]);
      await expect(page.getByRole("link", { name: "docs/" })).toBeVisible();
      await expect(page.locator("[data-entry] time").first()).toContainText("UTC");
      await page.getByRole("link", { name: "docs/" }).click();
      await expect(page).toHaveURL(/\/catalog\/docs\/$/);
      await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

test("large MPA uses deferred rows, worker search, filtering, and global search", async ({
  page,
}) => {
  await page.goto(urls.virtual);
  await expect
    .poll(async () => Number(await page.locator("[data-visible-count]").textContent()))
    .toBeGreaterThan(500);
  expect(await page.locator("[data-entry-list] [data-entry]").count()).toBeLessThan(100);
  await page.getByRole("searchbox", { name: "Search this folder" }).fill("file-0519");
  await expect(page.locator("[data-visible-count]")).toHaveText("1");
  await expect(page.locator("[data-entry-list] [data-entry]")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Files" }).uncheck();
  await expect(page.locator("[data-visible-count]")).toHaveText("0");
  await page.getByRole("checkbox", { name: "Files" }).check();
  await expect(page.locator("[data-visible-count]")).toHaveText("1");
  await page.getByRole("button", { name: "Search all files" }).click();
  await page
    .getByRole("dialog", { name: "Search all files" })
    .getByRole("searchbox")
    .fill("guide.txt");
  await expect(page.locator("[data-global-results] a.name")).toHaveCount(1);
});

test("large MPA can search when Worker is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Worker", { value: undefined });
  });
  await page.goto(urls.virtual);
  await expect
    .poll(async () => Number(await page.locator("[data-visible-count]").textContent()))
    .toBeGreaterThan(500);
  await page.getByRole("searchbox", { name: "Search this folder" }).fill("file-0519");
  await expect(page.locator("[data-visible-count]")).toHaveText("1");
  await expect(page.locator("[data-entry-list] [data-entry]")).toHaveCount(1);
});

test("large MPA keyboard navigation reaches rows outside the first viewport", async ({ page }) => {
  await page.goto(urls.virtual);
  await expect(page.locator("[data-explorer]")).not.toHaveAttribute("aria-busy", "true");
  await expect(page.locator("[data-visible-count]")).toHaveText("528");
  await page.keyboard.press("j");
  await expect(page.locator("[data-entry][data-active=true]")).toHaveAttribute("data-name", "docs");
  for (let index = 0; index < 40; index += 1) await page.keyboard.press("j");
  await expect(page.locator("[data-entry][data-active=true] a")).toBeFocused();
  await expect(page.locator("[data-entry][data-active=true]")).toHaveAttribute(
    "data-name",
    /file-00\d\d\.txt/,
  );
  await page.keyboard.press("Home");
  await expect(page.locator("[data-entry][data-active=true]")).toHaveAttribute("data-name", "docs");
});

test("large MPA remeasures wrapped rows after viewport resize", async ({ page }) => {
  await page.goto(urls.virtual);
  await expect
    .poll(async () => Number(await page.locator("[data-visible-count]").textContent()))
    .toBeGreaterThan(500);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 2));
  await expect
    .poll(async () => page.locator("[data-entry-list] [data-entry]:visible").count())
    .toBeGreaterThan(0);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect
    .poll(async () => page.locator("[data-entry-list] [data-entry]:visible").count())
    .toBeGreaterThan(0);
  expect(await page.locator("[data-entry-list] [data-entry]").count()).toBeLessThan(100);
});

for (const mode of ["serveSsg", "serveMpa"] as const) {
  test(`${mode}: server navigation, file policy, and live rebuild`, async ({ page }) => {
    await page.goto(urls[mode]);
    await assertFilePolicy(page);
    await page.getByRole("link", { name: "docs/" }).click();
    await expect(page).toHaveURL(/\/catalog\/docs\/$/);
    await page.getByRole("link", { name: "Home" }).click();
    await writeFile(path.join(sourceDirs[mode], `added-${mode}.txt`), "new\n");
    await expect(page.getByRole("link", { name: `added-${mode}.txt` })).toBeVisible();
    const response = await page.request.get(urls[mode]);
    expect(response.headers()["cache-control"]).toBe("no-store");
  });
}
