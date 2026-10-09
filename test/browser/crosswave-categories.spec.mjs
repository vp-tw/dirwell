import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createExplorerDevServer, createCrosswaveTheme } from "../../src/index.ts";
const categories = [
  {
    id: "code",
    label: "Source & scripts",
    icon: {
      svg: '<svg viewBox="0 0 24 24"><title>Decorative code icon</title><path d="m8 5-6 7 6 7m8-14 6 7-6 7"/></svg>',
    },
    match: { extensions: [".TS", "js"] },
  },
  { id: "browse", label: "Everything", icon: "all", match: "all" },
  { id: "dirs", label: "資料夾", icon: "folder", match: "folders" },
  { id: "pics", label: "Pictures", icon: "image", match: { mimeTypes: ["image/*"] } },
  {
    id: "notes",
    label: "Notes",
    icon: "document",
    match: { mimeTypes: ["text/*", "application/*+json"] },
  },
  { id: "remaining", label: "Unsorted", icon: "other", match: "other" },
];
let root, server;
test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), "cw-custom-browser-"));
  const source = path.join(root, "files");
  await mkdir(path.join(source, "Albums"), { recursive: true });
  for (const [name, contents] of [
    ["script.js", "code"],
    ["source.TS", "code"],
    ["note.md", "note"],
    ["data.jsonld", "{}"],
    ["photo.avif", "sample"],
    ["unknown.bin", "sample"],
    ["Albums/inside.js", "inside"],
  ])
    await writeFile(path.join(source, name), contents);
  server = await createExplorerDevServer({
    sourceDir: source,
    outputDir: path.join(root, "output"),
    mode: "mpa",
    theme: createCrosswaveTheme({ categories }),
    port: 0,
    host: "127.0.0.1",
  });
});
test.afterAll(async () => {
  await server.close();
  await rm(root, { recursive: true, force: true });
});

test("arbitrary first category, overlapping counts, trusted icon, keyboard, search, and history", async ({
  page,
}) => {
  await page.goto(server.url);
  await expect(page.getByRole("tab", { name: /Source & scripts/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".cw-stage [data-cw-count]")).toHaveText("2 items");
  await expect(page.getByRole("tab", { name: /Notes/ })).toHaveText("Notes3");
  await expect(page.locator(".cw-detail-symbol svg")).toHaveCount(1);
  await expect(page.getByRole("tab", { name: /Decorative code icon/ })).toHaveCount(0);
  await page.getByRole("tab", { name: /Source & scripts/ }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Everything/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /資料夾/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
  await expect(page).toHaveURL(/Albums\/$/);
  await expect(page.getByRole("tab", { name: /Source & scripts/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".cw-stage [data-cw-count]")).toHaveText("1 item");
  await page.goBack();
  await expect(page).toHaveURL(server.url);
  await expect(page.getByRole("tab", { name: /資料夾/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /Notes/ }).click();
  await page.getByRole("searchbox").fill("script");
  await expect(page.locator(".cw-stage [data-cw-count]")).toHaveText("1 item");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: /Unsorted/ }).click();
  await expect(page.locator(".cw-stage [data-cw-count]")).toHaveText("1 item");
  await expect(page.getByRole("link", { name: /unknown\.bin/ })).toBeVisible();
});

test("standard virtual controller advances custom IDs without a hardcoded All tab", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__pad = {
      id: "Custom categories pad",
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => [window.__pad] });
  });
  await page.goto(server.url);
  await expect(page.locator(".cw-controller")).toBeVisible();
  await page.evaluate(() => {
    window.__pad.buttons[15].pressed = true;
  });
  await expect(page.getByRole("tab", { name: /Everything/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.evaluate(() => {
    window.__pad.buttons[15].pressed = false;
  });
});
for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
])
  test(`custom categories ${viewport.width}x${viewport.height} remain touch usable`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto(server.url);
    await page.getByRole("tab", { name: /Pictures/ }).click();
    await expect(page.getByRole("link", { name: /photo\.avif/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test("a changed category configuration offers native reload instead of inconsistent filtering", async ({
  page,
}) => {
  await page.goto(server.url);
  await page.getByRole("tab", { name: /Everything/ }).click();
  const link = page.getByRole("link", { name: /Albums\/ Folder/ });
  const asset = await link.getAttribute("data-cw-page");
  const data = await (await page.request.get(asset)).text();
  await page.route(`${asset}*`, (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: data.replace(
        /data-cw-category-config=\\"[a-f0-9]+\\"/g,
        'data-cw-category-config=\\"different\\"',
      ),
    }),
  );
  await link.click();
  await expect(page.getByRole("link", { name: "Open normally", exact: true })).toBeVisible();
  await expect(page).toHaveURL(server.url);
});
