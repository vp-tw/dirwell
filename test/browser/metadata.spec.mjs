import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import {
  generateExplorer,
  createCrosswaveTheme,
  createDefaultTheme,
  createPlainTheme,
  createShareImage,
  describeContent,
} from "../../src/index.ts";

let root, source;
test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "dirwell-meta-browser-"));
  source = path.join(root, "files");
  await mkdir(path.join(source, "docs/deep"), { recursive: true });
  await writeFile(path.join(source, "README.txt"), "readme");
  await writeFile(path.join(source, "docs/guide.txt"), "guide");
});
test.afterAll(async () => rm(root, { recursive: true, force: true }));
async function app(theme, mode = "mpa", urls = "relative", dynamic = false) {
  const output = path.join(root, `${theme.name}-${mode}-${urls}-${dynamic}`);
  await generateExplorer({
    sourceDir: source,
    outputDir: output,
    mode,
    urlStrategy: urls,
    base: "/catalog/",
    theme,
    metadata: {
      siteName: "Design kit",
      ...(dynamic
        ? {
            description: ({ directory }) => describeContent(directory),
            image: async ({ directory, description }) => ({
              source: await createShareImage({
                theme: "crosswave",
                title: directory.relativePath || "Design kit",
                description,
              }),
              outputPath: `og/${directory.relativePath || "root"}.png`,
            }),
          }
        : {}),
    },
  });
  const server = createServer(async (req, res) => {
    try {
      let relative = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(
        /^\/catalog\//,
        "",
      );
      if (!relative || relative.endsWith("/")) relative += "index.html";
      const file = path.join(output, relative);
      const bytes = await readFile(file);
      res.setHeader(
        "Content-Type",
        file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : file.endsWith(".svg")
              ? "image/svg+xml"
              : file.endsWith(".woff2")
                ? "font/woff2"
                : file.endsWith(".png")
                  ? "image/png"
                  : "text/html",
      );
      res.end(bytes);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    output,
    url: `http://127.0.0.1:${server.address().port}/catalog/`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
for (const [name, factory, family] of [
  ["ledger", createDefaultTheme, "Source Sans 3"],
  ["plain", createPlainTheme, "Source Serif 4"],
  ["crosswave", createCrosswaveTheme, "Source Sans 3"],
]) {
  test(`${name}: offline local fonts, one static image, desktop/mobile layout`, async ({
    page,
  }) => {
    const site = await app(factory());
    try {
      await page.goto(site.url);
      await page.evaluate(() => document.fonts.ready);
      expect(await page.title()).toBe("Design kit");
      expect(await page.locator('meta[name="description"]').getAttribute("content")).toBe(
        "2 folders · 2 files",
      );
      expect(
        await page.evaluate(
          (f) =>
            document.fonts.check(`16px "${f}"`) &&
            getComputedStyle(document.body).fontFamily.includes(f),
          family,
        ),
      ).toBe(true);
      const image = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(
        await page.evaluate(
          (src) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve([img.naturalWidth, img.naturalHeight]);
              img.onerror = () => resolve([]);
              img.src = src;
            }),
          image,
        ),
      ).toEqual([1200, 630]);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        if (process.env.DIRWELL_CAPTURE) {
          await mkdir(".impeccable/review/metadata", { recursive: true });
          await page.screenshot({
            path: `.impeccable/review/metadata/${name}-${width === 390 ? "mobile" : "desktop"}.png`,
          });
        }
      }
      await page.goto(site.url + "docs/");
      expect(await page.title()).toBe("docs · Design kit");
      const nested = await page.locator('meta[property="og:image"]').getAttribute("content");
      expect(new URL(nested, page.url()).href).toBe(new URL(image, site.url).href);
    } finally {
      await site.close();
    }
  });
}
for (const mode of ["ssg", "mpa"])
  for (const urls of ["relative", "base", "html-base"]) {
    test(`Crosswave ${mode}/${urls}: managed metadata survives navigation and history`, async ({
      page,
    }) => {
      const site = await app(createCrosswaveTheme(), mode, urls, true);
      try {
        await page.goto(site.url);
        await expect(page.locator('[data-cw-category="all"]')).toBeVisible();
        await page.evaluate(() => (window.__canvas = document.querySelector("canvas")));
        await page.locator('[data-cw-entry][data-path="docs"] a').click();
        await expect(page).toHaveTitle("docs · Design kit");
        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
          "content",
          "1 folder · 1 file",
        );
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
          "content",
          site.url + "og/docs.png",
        );
        expect(
          await page.evaluate(() => window.__canvas === document.querySelector("canvas")),
        ).toBe(true);
        await page.goBack();
        await expect(page).toHaveTitle("Design kit");
        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
          "content",
          "1 folder · 1 file",
        );
        await page.goForward();
        await expect(page).toHaveTitle("docs · Design kit");
        expect(await page.locator('meta[property="og:image"]').count()).toBe(1);
      } finally {
        await site.close();
      }
    });
  }
for (const mode of ["ssg", "mpa"]) {
  test(`Crosswave ${mode} file URL: metadata image resolves after keyboard navigation`, async ({
    page,
  }) => {
    const site = await app(createCrosswaveTheme(), mode, "relative", true);
    try {
      await page.goto(pathToFileURL(path.join(site.output, "index.html")).href);
      await expect(page.locator('[data-cw-category="all"]')).toBeVisible();
      const link = page.locator('[data-cw-entry][data-path="docs"] a');
      await link.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveTitle("docs · Design kit");
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        "content",
        pathToFileURL(path.join(site.output, "og/docs.png")).href,
      );
      await page.goBack();
      await expect(page).toHaveTitle("Design kit");
    } finally {
      await site.close();
    }
  });
}

test("Ledger symlink target and status use bundled fonts", async ({ page }) => {
  const { symlink } = await import("node:fs/promises");
  const files = path.join(root, "link-fonts"),
    output = path.join(root, "link-fonts-output");
  await mkdir(files);
  await writeFile(path.join(files, "readme.txt"), "readme");
  await symlink("readme.txt", path.join(files, "alias"));
  await generateExplorer({ sourceDir: files, outputDir: output, metadata: { image: false } });
  await page.goto(pathToFileURL(path.join(output, "index.html")).href);
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.locator(".target").evaluate((node) => getComputedStyle(node).fontFamily),
  ).toContain("Source Code Pro");
  expect(await page.evaluate(() => document.fonts.check('12px "Source Code Pro"'))).toBe(true);
});
