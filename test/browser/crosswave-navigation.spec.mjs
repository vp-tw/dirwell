import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { generateExplorer, createCrosswaveTheme } from "../../src/index.ts";

let root, source;
test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "cw-navigation-"));
  source = path.join(root, "files");
  for (const folder of ["Albums/Deep", "Documents", "Space & 日本語", "Preserved", "Skipped"])
    await mkdir(path.join(source, folder), { recursive: true });
  await writeFile(path.join(source, "Albums/album.txt"), "album");
  await writeFile(path.join(source, "Albums/Deep/deep.txt"), "deep");
  await writeFile(path.join(source, "Documents/doc.txt"), "doc");
  await writeFile(path.join(source, "Space & 日本語/encoded.txt"), "encoded");
  await writeFile(path.join(source, "Preserved/index.html"), "<h1>Original page</h1>");
  await writeFile(path.join(source, "Skipped/index.html"), "<h1>Skipped source page</h1>");
  await writeFile(path.join(source, "Skipped/_dirwell.html"), "reserved");
  await writeFile(path.join(source, "root.txt"), "root");
  await symlink("Albums", path.join(source, "Alias"));
});
test.afterAll(async () => rm(root, { recursive: true, force: true }));
async function fixture(mode = "mpa", urlStrategy = "relative", outputName) {
  const output = path.join(root, `output-${mode}-${urlStrategy}-${outputName ?? "index"}`);
  await generateExplorer({
    sourceDir: source,
    outputDir: output,
    mode,
    urlStrategy,
    base: "/catalog/",
    ...(outputName ? { outputName } : {}),
    theme: createCrosswaveTheme(),
  });
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (!pathname.startsWith("/catalog/")) throw new Error("Unknown mount");
      let relative = pathname.slice("/catalog/".length);
      if (relative.endsWith("/") || !relative) relative += "index.html";
      const filename = path.join(output, relative);
      const bytes = await readFile(filename);
      response.setHeader(
        "Content-Type",
        filename.endsWith(".js")
          ? "text/javascript"
          : filename.endsWith(".css")
            ? "text/css"
            : "text/html",
      );
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end("missing");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    output,
    url: `http://127.0.0.1:${server.address().port}/catalog/`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
async function identity(page) {
  await page.evaluate(() => {
    window.__canvas = document.querySelector("#cw-wave");
    window.__document = document;
  });
}
async function preserved(page) {
  expect(
    await page.evaluate(
      () =>
        window.__document === document && window.__canvas === document.querySelector("#cw-wave"),
    ),
  ).toBe(true);
}
for (const mode of ["ssg", "mpa"])
  for (const urls of ["relative", "base", "html-base"]) {
    test(`${mode}/${urls}: persistent shell, encoded links, history, reload, and source pages`, async ({
      page,
    }) => {
      const app = await fixture(mode, urls);
      try {
        await page.goto(app.url);
        await identity(page);
        await page.getByRole("tab", { name: /Folders/ }).click();
        await page.getByRole("link", { name: /Albums\/ Folder/ }).focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/Albums\/$/);
        await expect(page.getByRole("link", { name: /album\.txt/ })).toBeVisible();
        await preserved(page);
        await page.goBack();
        await expect(page).toHaveURL(app.url);
        await expect(page.getByRole("tab", { name: /Folders/ })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await expect(page.getByRole("link", { name: /Albums\/ Folder/ })).toBeFocused();
        await page.goForward();
        await expect(page).toHaveURL(/Albums\/$/);
        await preserved(page);
        await page.reload();
        await expect(page.getByRole("link", { name: /album\.txt/ })).toBeVisible();
        await page.getByRole("link", { name: "Parent directory", exact: true }).click();
        await expect(page).toHaveURL(app.url);
        await page.getByRole("link", { name: /Space & 日本語\/ Folder/ }).click();
        await expect(page.getByRole("link", { name: /encoded\.txt/ })).toBeVisible();
        await page.getByRole("link", { name: "Parent directory", exact: true }).click();
        await page.getByRole("link", { name: /^Alias/ }).click();
        await expect(page.getByRole("link", { name: /album\.txt/ })).toBeVisible();
        await page.getByRole("link", { name: "Parent directory", exact: true }).click();
        await page.getByRole("link", { name: /Preserved\/ Folder/ }).click();
        await expect(page).toHaveURL(/Preserved\/_dirwell\.html$/);
        const original = page.waitForEvent("popup");
        await page.getByRole("link", { name: /index\.html File/ }).click();
        const popup = await original;
        await expect(popup.getByRole("heading", { name: "Original page" })).toBeVisible();
        await popup.close();
        await page.getByRole("link", { name: "Parent directory", exact: true }).click();
        const skipped = page.waitForEvent("popup");
        await page.getByRole("link", { name: /Skipped\/ Folder/ }).click();
        const skippedPage = await skipped;
        await expect(
          skippedPage.getByRole("heading", { name: "Skipped source page" }),
        ).toBeVisible();
        await skippedPage.close();
      } finally {
        await app.close();
      }
    });
  }
for (const mode of ["ssg", "mpa"])
  test(`${mode}: direct local files support hash navigation and reload`, async ({ page }) => {
    const app = await fixture(mode);
    try {
      await page.goto(pathToFileURL(path.join(app.output, "index.html")).href);
      await identity(page);
      await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
      await expect(page.getByRole("link", { name: /album\.txt/ })).toBeVisible();
      await preserved(page);
      expect(new URL(page.url()).hash).toContain("cw=");
      await page.reload();
      await expect(page.getByRole("link", { name: /album\.txt/ })).toBeVisible();
      await page.getByRole("link", { name: /Deep\/ Folder/ }).click();
      await expect(page.getByRole("link", { name: /deep\.txt/ })).toBeVisible();
      await page.goBack();
      await expect(page.getByRole("link", { name: /album\.txt/ })).toBeVisible();
      await page.getByRole("link", { name: "Parent directory", exact: true }).click();
      await expect(page.getByRole("link", { name: /root\.txt/ })).toBeVisible();
    } finally {
      await app.close();
    }
  });
test("custom page names retain direct links and native history", async ({ page }) => {
  const app = await fixture("mpa", "html-base", "listing.html");
  try {
    await page.goto(new URL("listing.html", app.url).href);
    await identity(page);
    await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
    await expect(page).toHaveURL(/Albums\/listing\.html$/);
    await preserved(page);
    await page.reload();
    await expect(page.getByRole("link", { name: /album\.txt/ })).toBeVisible();
    await page.getByRole("link", { name: "Parent directory", exact: true }).click();
    await expect(page).toHaveURL(new URL("listing.html", app.url).href);
  } finally {
    await app.close();
  }
});
test("slow superseded requests never overwrite the latest folder or add stale history", async ({
  page,
}) => {
  const app = await fixture();
  let release;
  const delayed = new Promise((resolve) => {
    release = resolve;
  });
  try {
    await page.goto(app.url);
    await identity(page);
    const albumAsset = await page
      .getByRole("link", { name: /Albums\/ Folder/ })
      .getAttribute("data-cw-page");
    await page.route(`${albumAsset}*`, async (route) => {
      await delayed;
      try {
        await route.continue();
      } catch {}
    });
    await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /root\.txt/ })).toBeVisible();
    await page.getByRole("link", { name: /Documents\/ Folder/ }).click();
    await expect(page).toHaveURL(/Documents\/$/);
    release();
    await page.waitForTimeout(200);
    await expect(page.getByRole("link", { name: /doc\.txt/ })).toBeVisible();
    await preserved(page);
    await page.goBack();
    await expect(page).toHaveURL(app.url);
  } finally {
    release();
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await app.close();
  }
});
test("missing or incompatible folder data keeps files usable and allows retry", async ({
  page,
}) => {
  const app = await fixture();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(app.url);
    await identity(page);
    await page.route("**/crosswave-page-*.js?*", (route) =>
      route.fulfill({ status: 404, body: "missing" }),
    );
    await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await expect(page).toHaveURL(app.url);
    await expect(page.getByRole("link", { name: /root\.txt/ })).toBeVisible();
    await page.unrouteAll();
    await page.route("**/crosswave-page-*.js?*", (route) =>
      route.fulfill({ contentType: "text/javascript", body: "/* incompatible old build */" }),
    );
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByRole("link", { name: "Open normally", exact: true })).toBeVisible();
    await page.unrouteAll();
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page).toHaveURL(/Albums\/$/);
    await preserved(page);
    expect(errors).toEqual([]);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await app.close();
  }
});
test("cancel, timeout, reduced motion, and interruption do not strand an invisible page", async ({
  page,
}) => {
  const app = await fixture();
  let release;
  const delayed = new Promise((resolve) => {
    release = resolve;
  });
  try {
    await page.clock.install();
    await page.goto(app.url);
    await identity(page);
    await page.route("**/crosswave-page-*.js?*", async (route) => {
      await delayed;
      try {
        await route.abort();
      } catch {}
    });
    await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
    await page.clock.fastForward(150);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator("[data-cw-root]")).not.toHaveAttribute("aria-busy", "true");
    await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
    await page.clock.fastForward(8100);
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    release();
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.clock.resume();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page).toHaveURL(/Albums\/$/);
    expect(
      await page.evaluate(() => document.querySelector(".cw-browser").getAnimations().length),
    ).toBe(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("link", { name: "Parent directory", exact: true }).click();
    await expect(page).toHaveURL(app.url);
    await page.getByRole("link", { name: /Documents\/ Folder/ }).click();
    await expect(page).toHaveURL(/Documents\/$/);
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(() => getComputedStyle(document.querySelector(".cw-browser")).opacity),
    ).toBe("1");
    await expect(page.locator(".cw-transition-layer")).toHaveCount(0);
    await preserved(page);
  } finally {
    release();
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await app.close();
  }
});

test("restricted history retains native navigation", async ({ page }) => {
  const app = await fixture();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      history.replaceState = () => {
        throw new DOMException("Denied", "SecurityError");
      };
    });
    await page.goto(app.url);
    await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
    await expect(page).toHaveURL(/Albums\/$/);
    await expect(page.getByRole("link", { name: /album\.txt/ })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test("script CSP failure leaves current files, and Open normally reaches the destination", async ({
  page,
}) => {
  const app = await fixture();
  try {
    await page.goto(app.url);
    await page.evaluate(() => {
      const meta = document.createElement("meta");
      meta.httpEquiv = "Content-Security-Policy";
      meta.content = "script-src 'none'";
      document.head.append(meta);
    });
    await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /root\.txt/ })).toBeVisible();
    await page.getByRole("link", { name: "Open normally", exact: true }).click();
    await expect(page).toHaveURL(/Albums\/$/);
    await expect(page.getByRole("link", { name: /album\.txt/ })).toBeVisible();
  } finally {
    await app.close();
  }
});

test("history push failure preserves the current address and files", async ({ page }) => {
  const app = await fixture();
  try {
    await page.goto(app.url);
    await page.evaluate(() => {
      history.pushState = () => {
        throw new DOMException("Denied", "SecurityError");
      };
    });
    await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await expect(page).toHaveURL(app.url);
    await expect(page.getByRole("link", { name: /root\.txt/ })).toBeVisible();
    await expect(page.locator(".cw-transition-layer")).toHaveCount(0);
  } finally {
    await app.close();
  }
});

test("parser and animation failures retain a recoverable or usable page", async ({ page }) => {
  const app = await fixture();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(app.url);
    await page.evaluate(() => {
      window.__parse = DOMParser.prototype.parseFromString;
      DOMParser.prototype.parseFromString = () => {
        throw new TypeError("Trusted HTML required");
      };
    });
    await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible();
    await expect(page).toHaveURL(app.url);
    await page.evaluate(() => {
      DOMParser.prototype.parseFromString = window.__parse;
      Element.prototype.animate = () => {
        throw new DOMException("Unavailable", "NotSupportedError");
      };
    });
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page).toHaveURL(/Albums\/$/);
    await expect(page.getByRole("link", { name: /album\.txt/ })).toBeVisible();
    await expect(page.locator(".cw-transition-layer")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});

test("large folder exchanges bound animation layers and restore exact view state", async ({
  page,
}) => {
  test.setTimeout(30_000);
  await mkdir(path.join(source, "Large"));
  await Promise.all(
    Array.from({ length: 1000 }, (_, i) =>
      writeFile(path.join(source, "Large", `file-${String(i).padStart(4, "0")}.txt`), "sample"),
    ),
  );
  const app = await fixture();
  try {
    await page.goto(app.url);
    await identity(page);
    await page.evaluate(() => {
      window.__frames = [];
      let last = performance.now();
      window.__running = true;
      const frame = (time) => {
        window.__frames.push(time - last);
        last = time;
        if (window.__running) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await page.getByRole("link", { name: /Large\/ Folder/ }).click();
    await expect(page).toHaveURL(/Large\/$/);
    await expect(page.locator(".cw-stage [data-cw-entry]")).toHaveCount(1000);
    expect(await page.locator(".cw-transition-layer .cw-row").count()).toBeLessThan(25);
    await page.waitForTimeout(300);
    await page.mouse.move(0, 0);
    await page.getByRole("link", { name: /file-0500\.txt/ }).focus();
    await page.evaluate(() => {
      document.querySelector(".cw-list-scroll").scrollTop = 20000;
    });
    const scroll = await page.evaluate(() => document.querySelector(".cw-list-scroll").scrollTop);
    await page.getByRole("link", { name: "Parent directory", exact: true }).click();
    await expect(page).toHaveURL(app.url);
    await page.goBack();
    await expect(page).toHaveURL(/Large\/$/);
    await expect(page.getByRole("link", { name: /file-0500\.txt/ })).toBeFocused();
    expect(await page.evaluate(() => document.querySelector(".cw-list-scroll").scrollTop)).toBe(
      scroll,
    );
    const timings = await page.evaluate(() => {
      window.__running = false;
      const frames = window.__frames.filter((x) => x > 0).sort((a, b) => a - b);
      return {
        frames: frames.length,
        p95Ms: frames[Math.floor(frames.length * 0.95)],
        longestMs: frames.at(-1),
      };
    });
    console.log("Crosswave 1000-row frame timing", JSON.stringify(timings));
    await preserved(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      const scroll = document.querySelector(".cw-list-scroll");
      scroll.style.maxHeight = "none";
      scroll.scrollTop = 0;
      window.scrollTo(0, 1000);
      window.__bounds = { rows: 0, clip: false };
      new MutationObserver(() => {
        const layers = [...document.querySelectorAll(".cw-transition-layer")];
        const rows = document.querySelectorAll(".cw-transition-layer .cw-row").length;
        if (rows > window.__bounds.rows)
          window.__bounds = {
            rows,
            clip: layers.every((layer) => layer.style.clipPath.startsWith("inset(")),
          };
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.keyboard.press("Backspace");
    await expect(page).toHaveURL(app.url);
    const bounds = await page.evaluate(() => window.__bounds);
    expect(bounds.rows).toBeLessThan(25);
    expect(bounds.rows).toBeGreaterThan(0);
    expect(bounds.clip).toBe(true);
    console.log("Crosswave portrait viewport bounds", JSON.stringify(bounds));
  } finally {
    await app.close();
    await rm(path.join(source, "Large"), { recursive: true, force: true });
  }
});

test("keyboard cancellation and Home abort pending loads without adding history", async ({
  page,
}) => {
  const app = await fixture();
  let release;
  const delayed = new Promise((resolve) => {
    release = resolve;
  });
  try {
    await page.goto(app.url);
    const length = await page.evaluate(() => history.length);
    await page.route("**/crosswave-page-*.js?*", async (route) => {
      await delayed;
      try {
        await route.abort();
      } catch {}
    });
    for (const action of ["Escape", "Backspace", "Home"]) {
      await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
      await expect(page.locator("[data-cw-root]")).toHaveAttribute("aria-busy", "true");
      if (action === "Home") await page.getByRole("link", { name: "Home", exact: true }).click();
      else await page.keyboard.press(action);
      await expect(page.locator("[data-cw-root]")).not.toHaveAttribute("aria-busy", "true");
      await expect(page).toHaveURL(app.url);
      expect(await page.evaluate(() => history.length)).toBe(length);
    }
  } finally {
    release();
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await app.close();
  }
});
