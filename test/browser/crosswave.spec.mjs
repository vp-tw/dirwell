import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createExplorerDevServer } from "../../src/dev-server.ts";
import { createCrosswaveTheme } from "../../src/theme-crosswave.ts";

let root, server;
test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "crosswave-browser-"));
  const sourceDir = path.join(root, "files");
  await mkdir(path.join(sourceDir, "Albums"), { recursive: true });
  await mkdir(path.join(sourceDir, "Empty"));
  await writeFile(path.join(sourceDir, "Albums/inside.txt"), "inside");
  await writeFile(path.join(sourceDir, "note.txt"), "note");
  await writeFile(path.join(sourceDir, "image.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await writeFile(path.join(sourceDir, "audio.wav"), "audio specimen");
  await writeFile(path.join(sourceDir, "video.webm"), "video specimen");
  await writeFile(
    path.join(
      sourceDir,
      "A very long filename with 日本語 and spaces to verify mobile wrapping and keyboard focus.txt",
    ),
    "long",
  );
  await symlink("missing.txt", path.join(sourceDir, "unavailable"));
  server = await createExplorerDevServer({
    sourceDir,
    outputDir: path.join(root, "output"),
    theme: createCrosswaveTheme(),
    mode: "mpa",
    host: "127.0.0.1",
    port: 0,
  });
});
test.afterAll(async () => {
  await server.close();
  await rm(root, { recursive: true, force: true });
});

test("categories, keyboard navigation, search composition, and page transitions", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.addEventListener("pagereveal", (event) => {
      window.__cwTransition = Boolean(event.viewTransition);
    });
  });
  await page.goto(server.url);
  await expect(page.locator("body")).toHaveAttribute("data-cw-enhanced", "true");
  await expect(page.locator(".cw-brand span")).toHaveText("Crosswave");
  const pause = page.getByRole("button", { name: "Pause waves" });
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("tab", { name: /All files/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Folders/ })).toHaveAttribute("aria-selected", "true");
  await expect(pause).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".cw-selected")).toHaveAttribute("data-name", "Empty");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".cw-selected")).toHaveAttribute("data-name", "Albums");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/Albums\/$/);
  expect(await page.evaluate(() => window.__cwTransition)).toBe(true);
  await expect(page.getByRole("link", { name: /inside\.txt/ })).toBeVisible();
  await page.keyboard.press("Backspace");
  await expect(page).toHaveURL(server.url);
  await page.keyboard.press("/");
  const search = page.getByRole("searchbox", { name: "Search this folder" });
  await expect(search).toBeFocused();
  await search.dispatchEvent("compositionstart");
  await search.fill("nothing");
  await expect(page.locator("[data-cw-count]")).not.toHaveText("0 items");
  await search.dispatchEvent("compositionend");
  await expect(page.locator("[data-cw-count]")).toHaveText("0 items");
  await expect(page.locator(".cw-empty")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toHaveValue("");
  await expect(page.locator(".cw-empty")).toBeHidden();
  expect(errors).toEqual([]);
});

test("palette and wave controls remain isolated and persist across directories", async ({
  page,
}) => {
  await page.goto(server.url);
  await page.getByLabel("Background color").selectOption("rose");
  await expect(page.locator("html")).toHaveAttribute("data-cw-color", "rose");
  await page.getByRole("button", { name: "Pause waves" }).click();
  await expect(page.getByRole("button", { name: "Resume waves" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-cw-color", "rose");
  await expect(page.getByRole("button", { name: "Resume waves" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Resume waves" }).click();
  await expect(page.getByRole("button", { name: "Pause waves" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("reduced motion and denied WebGL retain complete usable links", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(server.url);
  await expect(page.getByRole("button", { name: "Reduced motion" })).toBeDisabled();
  await expect(page.getByRole("link", { name: /note\.txt/ })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === "webgl" ? null : native.call(this, type, ...args);
    };
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Static background" })).toBeDisabled();
  await expect(page.getByRole("link", { name: /note\.txt/ })).toBeVisible();
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`responsive ${viewport.width}x${viewport.height}: search, tabs, and long paths`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(server.url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("tab", { name: /Documents/ }).click();
    await expect(page.getByRole("tab", { name: /Documents/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("searchbox").fill("日本語");
    await expect(page.locator("[data-cw-count]")).toHaveText("1 item");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("no JavaScript leaves native file and directory navigation", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(server.url);
  await expect(page.getByRole("tab", { name: /Folders/ })).toBeHidden();
  await expect(page.getByRole("link", { name: /Albums\/ Folder/ })).toBeVisible();
  await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
  await expect(page.getByRole("link", { name: /inside\.txt/ })).toBeVisible();
  await context.close();
});

test("virtual standard gamepad: deadzone, held repeat, release, navigation, disconnect", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__pads = [];
    Object.defineProperty(navigator, "getGamepads", { value: () => window.__pads });
    window.__connect = () => {
      window.__pads = [
        {
          id: "Virtual standard controller",
          index: 0,
          connected: true,
          mapping: "standard",
          timestamp: 0,
          axes: [0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
        },
      ];
      window.dispatchEvent(new Event("gamepadconnected"));
    };
  });
  await page.goto(server.url);
  await page.evaluate(() => window.__connect());
  await expect(page.locator(".cw-controller")).toBeVisible();
  await page.evaluate(() => {
    window.__pads[0].axes[0] = 0.2;
  });
  await page.waitForTimeout(100);
  await expect(page.getByRole("tab", { name: /All files/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.evaluate(() => {
    window.__tabHistory = [];
    new MutationObserver(() =>
      window.__tabHistory.push(
        document.querySelector('[role="tab"][aria-selected="true"]').dataset.cwCategory,
      ),
    ).observe(document.querySelector(".cw-categories"), {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-selected"],
    });
    window.__pads[0].axes[0] = 0.8;
  });
  await expect(page.getByRole("tab", { name: /Folders/ })).toHaveAttribute("aria-selected", "true");
  // Holding a direction advances again after the initial repeat delay.
  await expect.poll(() => page.evaluate(() => window.__tabHistory.includes("image"))).toBe(true);
  const releasedCategory = await page.evaluate(() => {
    window.__pads[0].axes[0] = 0;
    return document.querySelector('[role="tab"][aria-selected="true"]').dataset.cwCategory;
  });
  await page.waitForTimeout(180);
  await expect(page.locator(`[data-cw-category="${releasedCategory}"]`)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: /Folders/ }).click();
  await expect(page.getByRole("tab", { name: /Folders/ })).toHaveAttribute("aria-selected", "true");
  await page.evaluate(() => {
    window.__pads[0].buttons[13].pressed = true;
  });
  await expect(page.locator(".cw-selected")).toHaveAttribute("data-name", "Empty");
  await page.evaluate(() => {
    window.__pads[0].buttons[13].pressed = false;
    window.__pads[0].buttons[12].pressed = true;
  });
  await expect(page.locator(".cw-selected")).toHaveAttribute("data-name", "Albums");
  await page.evaluate(() => {
    window.__pads[0].buttons[12].pressed = false;
    window.__pads[0].buttons[0].pressed = true;
  });
  await expect(page).toHaveURL(/Albums\/$/);
  // Every document receives a fresh virtual navigator; connect and release before Back.
  await page.evaluate(() => window.__connect());
  await expect(page.locator(".cw-controller")).toBeVisible();
  await page.evaluate(() => {
    window.__pads[0].buttons[1].pressed = true;
  });
  await expect(page).toHaveURL(server.url);
  await page.evaluate(() => window.__connect());
  await expect(page.locator(".cw-controller")).toBeVisible();
  await page.evaluate(() => {
    window.__pads = [];
    window.dispatchEvent(new Event("gamepaddisconnected"));
  });
  await expect(page.locator(".cw-controller")).toBeHidden();
});

test("held confirm at connection never opens a file until released", async ({ page, context }) => {
  await page.addInitScript(() => {
    const pad = {
      id: "Held controller",
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({
        pressed: i === 0,
        value: i === 0 ? 1 : 0,
        touched: false,
      })),
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
    window.__pad = pad;
  });
  await page.goto(server.url);
  await expect(page.locator(".cw-controller")).toBeVisible();
  await page.waitForTimeout(500);
  expect(page.url()).toBe(server.url);
  expect(context.pages()).toHaveLength(1);
  await page.evaluate(() => {
    window.__pad.buttons[0].pressed = false;
    window.__pad.buttons[0].value = 0;
  });
  await page.waitForTimeout(60);
  await page.evaluate(() => {
    window.__pad.buttons[0].pressed = true;
    window.__pad.buttons[0].value = 1;
  });
  await expect(page).toHaveURL(/Albums\/$/);
  await expect(page.locator(".cw-controller")).toBeVisible();
  await page.waitForTimeout(500);
  expect(context.pages()).toHaveLength(1);
});

test("storage denial and WebGL context loss preserve navigation", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Denied");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Denied");
    };
  });
  await page.goto(server.url);
  await page.getByLabel("Background color").selectOption("jade");
  await expect(page.locator("html")).toHaveAttribute("data-cw-color", "jade");
  await page.evaluate(() =>
    document
      .querySelector("#cw-wave")
      .dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );
  await expect(page.getByRole("button", { name: "Static background" })).toBeDisabled();
  await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
  await expect(page).toHaveURL(/Albums\/$/);
});

test("controller file activation retains opener isolation and a blocked-tab recovery", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    window.__pads = [];
    Object.defineProperty(navigator, "getGamepads", { value: () => window.__pads });
    window.__connect = () => {
      window.__pads = [
        {
          id: "Virtual controller",
          index: 0,
          connected: true,
          mapping: "standard",
          axes: [0, 0],
          buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
        },
      ];
      window.dispatchEvent(new Event("gamepadconnected"));
    };
  });
  await page.goto(server.url);
  await page.evaluate(() => window.__connect());
  await expect(page.locator(".cw-controller")).toBeVisible();
  await page.getByRole("link", { name: /note\.txt/ }).focus();
  const popup = context.waitForEvent("page");
  await page.evaluate(() => {
    window.__pads[0].buttons[0].pressed = true;
  });
  const file = await popup;
  await expect(file).toHaveURL(/note\.txt$/);
  await file.waitForLoadState();
  expect(await file.evaluate(() => window.opener)).toBe(null);
  expect(file.url()).toContain("note.txt");
  await file.close();
  await page.bringToFront();
  await page.evaluate(() => {
    window.__pads[0].buttons[0].pressed = false;
    window.open = () => null;
  });
  await page.waitForTimeout(60);
  await page.evaluate(() => {
    window.__pads[0].buttons[0].pressed = true;
  });
  await expect(page.locator(".cw-notice")).toContainText("Press Enter or click the file");
  await expect(page.getByRole("link", { name: /note\.txt/ })).toBeFocused();
});

test("controller Back exits search without navigating away", async ({ page }) => {
  await page.addInitScript(() => {
    const pad = {
      id: "Search controller",
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
    window.__pad = pad;
  });
  await page.goto(server.url);
  await expect(page.locator(".cw-controller")).toBeVisible();
  await page.evaluate(() => {
    window.__pad.buttons[9].pressed = true;
  });
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.getByRole("searchbox").fill("note");
  await page.evaluate(() => {
    window.__pad.buttons[9].pressed = false;
    window.__pad.buttons[1].pressed = true;
  });
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page.getByRole("searchbox")).not.toBeFocused();
  expect(page.url()).toBe(server.url);
});
