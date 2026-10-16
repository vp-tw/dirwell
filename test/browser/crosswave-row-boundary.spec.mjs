import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { generateExplorer } from "../../packages/core/dist/index.mjs";
import { createCrosswaveTheme } from "../../packages/theme-crosswave/dist/index.mjs";

let root, server, url;
const longName = "Unavailable-notes-日本語-" + "long-name-".repeat(7);
test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "cw-row-boundary-"));
  const sourceDir = path.join(root, "files");
  await mkdir(path.join(sourceDir, "docs"), { recursive: true });
  await writeFile(path.join(sourceDir, "file.bin"), Buffer.alloc(1310720));
  await writeFile(path.join(sourceDir, "docs", "note.txt"), "note");
  await symlink("file.bin", path.join(sourceDir, "alias.bin"));
  await symlink("Missing.txt", path.join(sourceDir, "Unavailable-notes"));
  await symlink("missing/" + "long-target-".repeat(9), path.join(sourceDir, longName));
  for (const mode of ["ssg", "mpa"])
    for (const exact of ["none", "details"])
      await generateExplorer({
        sourceDir,
        outputDir: path.join(root, mode + "-" + exact),
        mode,
        theme: createCrosswaveTheme({
          gamepad: false,
          backgroundMotion: false,
          size: { exact },
          actions: ["download"],
        }),
      });
  const largeSource = path.join(root, "large-files");
  await mkdir(largeSource);
  await Promise.all(
    Array.from({ length: 510 }, (_, i) =>
      symlink("missing.txt", path.join(largeSource, `link-${String(i).padStart(3, "0")}`)),
    ),
  );
  await generateExplorer({
    sourceDir: largeSource,
    outputDir: path.join(root, "large"),
    theme: createCrosswaveTheme({ gamepad: false, backgroundMotion: false }),
  });
  server = createServer(async (req, res) => {
    try {
      let file = path.resolve(
        root,
        "." + decodeURIComponent(new URL(req.url, "http://test").pathname),
      );
      if (!file.startsWith(root + path.sep)) throw new Error("Outside fixture");
      if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
      res
        .writeHead(200, {
          "content-type": file.endsWith(".js")
            ? "text/javascript"
            : file.endsWith(".html")
              ? "text/html"
              : "application/octet-stream",
        })
        .end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  await mkdir(".impeccable/review/crosswave-row", { recursive: true });
});
test.afterAll(async () => {
  if (server)
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  if (root) await rm(root, { recursive: true, force: true });
});

async function tab(page, reverse = false) {
  // macOS WebKit uses Option+Tab to include links in its native focus cycle.
  const option =
    process.platform === "darwin" && page.context().browser().browserType().name() === "webkit"
      ? "Alt+"
      : "";
  await page.keyboard.press((reverse ? "Shift+" : "") + option + "Tab");
}
async function focusLink(page, row) {
  await row.locator("a.cw-entry").focus();
  await tab(page, true);
  await tab(page);
  await expect(row.locator("a.cw-entry")).toBeFocused();
}

async function boundary(row, kind) {
  return row.evaluate((element, kind) => {
    const primary = element.querySelector(".cw-entry");
    let surface = primary;
    while (surface && surface !== element.parentElement) {
      const style = getComputedStyle(surface);
      if (
        kind === "focus"
          ? parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== "none"
          : style.backgroundImage !== "none"
      )
        break;
      surface = surface.parentElement;
    }
    if (!surface || surface === element.parentElement) return { found: false };
    const outer = surface.getBoundingClientRect();
    const rects = [...element.querySelectorAll(".cw-name, .cw-target, .dw-size-line")]
      .filter((node) => {
        const details = node.closest("details");
        return (
          (!details || details.open || node.closest("summary")) &&
          node.getBoundingClientRect().height
        );
      })
      .map((node) => node.getBoundingClientRect());
    const inside = rects.every(
      (rect) =>
        rect.left >= outer.left - 1 &&
        rect.right <= outer.right + 1 &&
        rect.top >= outer.top - 1 &&
        rect.bottom <= outer.bottom + 1,
    );
    const name = element.querySelector(".cw-name").getBoundingClientRect();
    const size = element.querySelector(".cw-size-cell").getBoundingClientRect();
    const next = element.nextElementSibling?.getBoundingClientRect();
    const scroll = element.closest(".cw-list-scroll").getBoundingClientRect();
    const footer = document.querySelector(".cw-bottom");
    const footerTop =
      footer && getComputedStyle(footer).display !== "none"
        ? footer.getBoundingClientRect().top
        : innerHeight;
    return {
      found: true,
      inside,
      aboveFooter: outer.bottom <= footerTop + 1,
      verticallyVisible:
        outer.top >= Math.max(scroll.top, 0) - 1 &&
        outer.bottom <= Math.min(scroll.bottom, footerTop, innerHeight) + 1,
      inlineVisible: outer.left >= scroll.left && outer.right <= scroll.right,
      aligned:
        Math.abs(
          name.left -
            (size.left +
              parseFloat(getComputedStyle(element.querySelector(".cw-size-cell")).paddingLeft)),
        ) < 1,
      overlapsNext: next ? outer.bottom > next.top + 1 : false,
    };
  }, kind);
}

for (const mode of ["ssg", "mpa"])
  for (const javaScriptEnabled of [true, false])
    test(`${mode} ${javaScriptEnabled ? "enhanced" : "native"}: whole-row selection and primary focus contain metadata`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({ javaScriptEnabled, reducedMotion: "reduce" });
      try {
        const page = await context.newPage();
        await page.goto(`${url}/${mode}-none/`);
        if (javaScriptEnabled) await expect(page.getByRole("searchbox").first()).toBeEnabled();
        const row = page
          .locator("[data-cw-entry]")
          .filter({ has: page.locator(".cw-name", { hasText: /^Unavailable-notes$/ }) });
        for (const viewport of [
          { width: 1280, height: 800 },
          { width: 390, height: 844 },
          { width: 320, height: 740 },
          { width: 844, height: 390 },
        ]) {
          await page.setViewportSize(viewport);
          if (javaScriptEnabled)
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
          await focusLink(page, row);
          if (
            process.env.CW_CAPTURE &&
            mode === "ssg" &&
            javaScriptEnabled &&
            testInfo.project.name === ""
          )
            await page.screenshot({
              path: `.impeccable/review/crosswave-row/${process.env.CW_CAPTURE}-${viewport.width}.png`,
              fullPage: viewport.height !== 390,
            });
          expect(await boundary(row, "focus")).toMatchObject({
            ...(javaScriptEnabled ? { aboveFooter: true, verticallyVisible: true } : {}),
            found: true,
            inside: true,
            inlineVisible: true,
            aligned: true,
            overlapsNext: false,
          });
          if (javaScriptEnabled)
            expect(await boundary(row, "selection")).toMatchObject({
              found: true,
              inside: true,
              inlineVisible: true,
              aligned: true,
              overlapsNext: false,
            });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          ).toBe(true);
          await expect(row.locator(".cw-size-cell")).toContainText("Target Unavailable");
          await expect(row.locator(".cw-size-cell")).toContainText("Link 11 B");
        }
        await page.setViewportSize({ width: 390, height: 844 });
        const longRow = page
          .locator("[data-cw-entry]")
          .filter({ has: page.locator(".cw-name", { hasText: longName }) });
        await page.evaluate(() => {
          const style = document.createElement("style");
          style.textContent =
            ".cw-name{font-size:36px}.cw-target,.cw-size-cell{font-size:24px}.cw-entry-label,.cw-size-cell{line-height:1.5;letter-spacing:.12em;word-spacing:.16em}";
          document.head.append(style);
        });
        await focusLink(page, longRow);
        expect(await boundary(longRow, "focus")).toMatchObject({
          found: true,
          inside: true,
          inlineVisible: true,
          aligned: true,
          overlapsNext: false,
        });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        if (javaScriptEnabled) {
          await page.setViewportSize({ width: 320, height: 740 });
          await focusLink(page, longRow);
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          const lastValue = longRow.locator(".dw-size-line").last();
          expect(
            await lastValue.evaluate((node) => {
              const rect = node.getBoundingClientRect();
              return (
                rect.top >= 0 &&
                rect.bottom < document.querySelector(".cw-bottom").getBoundingClientRect().top &&
                node.contains(document.elementFromPoint(rect.left + 2, rect.top + rect.height / 2))
              );
            }),
          ).toBe(true);
          if (process.env.CW_CAPTURE && mode === "ssg" && testInfo.project.name === "")
            await page.screenshot({
              path: `.impeccable/review/crosswave-row/${process.env.CW_CAPTURE}-320-long-viewport.png`,
            });
        }
      } finally {
        await context.close();
      }
    });

for (const mode of ["ssg", "mpa"])
  test(`${mode}: exact disclosure and download keep their own focus and activation`, async ({
    page,
  }) => {
    await page.goto(`${url}/${mode}-details/`);
    await expect(page.getByRole("searchbox").first()).toBeEnabled();
    const row = page
      .locator("[data-cw-entry]")
      .filter({ has: page.locator(".cw-name", { hasText: /^alias.bin$/ }) });
    await focusLink(page, row);
    expect(await boundary(row, "focus")).toMatchObject({ inside: true });
    const summary = row.locator("summary");
    await tab(page);
    await expect(summary).toBeFocused();
    const location = page.url();
    await page.keyboard.press("Enter");
    await expect(row.locator("details")).toHaveAttribute("open", "");
    await expect(row.locator(".dw-size-exact")).toContainText("1,310,720 B");
    expect(await boundary(row, "selection")).toMatchObject({ inside: true, overlapsNext: false });
    await expect(summary).toHaveCSS("outline-style", "solid");
    expect(page.url()).toBe(location);
    await tab(page);
    await expect(row.getByRole("link", { name: "Download" })).toBeFocused();
    const download = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    await download;
    expect(page.url()).toBe(location);
    const popup = page.waitForEvent("popup");
    await row.locator("a.cw-entry").click();
    await (await popup).close();
    await page
      .locator("[data-cw-entry]")
      .filter({ has: page.locator(".cw-name", { hasText: /^docs\/$/ }) })
      .locator("a.cw-entry")
      .click();
    await expect(page.locator(".cw-name", { hasText: "note.txt" })).toBeVisible();
  });

for (const width of [1280, 320])
  test(`virtual rows at ${width}px keep metadata together during keyboard scrolling`, async ({
    page,
  }) => {
    await page.goto(`${url}/large/`);
    await expect(page.locator(".cw-list-scroll")).toHaveAttribute("data-virtual", "true");
    await page.setViewportSize({ width, height: 740 });
    const first = page.locator("[data-cw-entry]").first();
    await focusLink(page, first);
    for (let i = 0; i < 45; i++) await page.keyboard.press("ArrowDown");
    await expect(page.locator("a.cw-entry:focus")).toContainText("link-045");
    const row = page.locator("[data-cw-entry]:has(a.cw-entry:focus)");
    expect(await boundary(row, "focus")).toMatchObject({
      inside: true,
      inlineVisible: true,
      aligned: true,
      overlapsNext: false,
    });
    await page.keyboard.press("ArrowDown");
    await expect(page.locator("a.cw-entry:focus")).toContainText("link-046");
  });
