import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, readFile, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { generateExplorer } from "../../packages/core/dist/index.mjs";
import { createPlainTheme } from "../../packages/theme-plain/dist/index.mjs";
let root, server, url;
test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "dirwell-plain-hint-browser-"));
  const sourceDir = path.join(root, "files");
  await mkdir(path.join(sourceDir, "docs"), { recursive: true });
  await writeFile(path.join(sourceDir, "note.txt"), "Native file contents");
  await symlink("note.txt", path.join(sourceDir, "alias"));
  for (const mode of ["ssg", "mpa"])
    await generateExplorer({
      sourceDir,
      outputDir: path.join(root, mode),
      mode,
      theme: createPlainTheme({ actions: ["download"] }),
    });
  server = createServer(async (req, res) => {
    try {
      let file = path.resolve(root, "." + new URL(req.url, "http://test").pathname);
      if (!file.startsWith(root + path.sep)) throw new Error("Outside");
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      res
        .writeHead(200, { "content-type": file.endsWith(".html") ? "text/html" : "text/plain" })
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
for (const mode of ["ssg", "mpa"])
  test(`Plain ${mode}: new tabs stay intact with accessible hints instead of visible captions`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      const home = `${url}/${mode}/`;
      await page.goto(home);
      const file = page.getByRole("link", { name: "note.txt", exact: true });
      await expect(file).toHaveAttribute("target", "_blank");
      await expect(file).toHaveAttribute("rel", "noopener");
      await expect(file).toHaveAccessibleDescription("opens in a new tab");
      await expect(page.getByText("opens in a new tab", { exact: true })).toBeHidden();
      await expect(page.locator("li small")).not.toContainText(["opens in a new tab"]);
      const [popup] = await Promise.all([context.waitForEvent("page"), file.click()]);
      await expect(popup).toHaveURL(`${home}note.txt`);
      await expect(popup.locator("body")).toContainText("Native file contents");
      await expect(page).toHaveURL(home);
      await popup.close();
      const folder = page.getByRole("link", { name: "docs/", exact: true });
      await expect(folder).not.toHaveAttribute("target");
      await expect(folder).toHaveAccessibleDescription("");
      await folder.click();
      await expect(page).toHaveURL(`${home}docs/index.html`);
      await page.getByRole("link", { name: "../", exact: true }).click();
      const alias = page.getByRole("link", { name: "alias", exact: true });
      await expect(alias).toHaveAccessibleDescription("opens in a new tab");
      await alias.focus();
      const [keyboardPopup] = await Promise.all([
        context.waitForEvent("page"),
        page.keyboard.press("Enter"),
      ]);
      await expect(keyboardPopup).toHaveURL(`${home}note.txt`);
      await keyboardPopup.close();
      const row = page.locator("li").filter({ has: file });
      const downloadLink = row.getByRole("link", { name: "Download", exact: true });
      await expect(downloadLink).toHaveAccessibleDescription("");
      const [download] = await Promise.all([page.waitForEvent("download"), downloadLink.click()]);
      expect(download.suggestedFilename()).toBe("note.txt");
      expect(context.pages()).toHaveLength(1);
      if (mode === "ssg") {
        await page.screenshot({
          path: ".impeccable/review/plain-hint-desktop.png",
          fullPage: true,
        });
        await page.setViewportSize({ width: 320, height: 740 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({ path: ".impeccable/review/plain-hint-mobile.png", fullPage: true });
      }
    } finally {
      await context.close();
    }
  });
