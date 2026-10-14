import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { pathToFileURL } from "node:url";
const packageRoot = process.env.DIRWELL_AUTHORING_CONSUMER_ROOT;
const authoringUrl = packageRoot
  ? pathToFileURL(path.join(packageRoot, "node_modules/@dirwell/theme-authoring/dist/index.mjs"))
  : new URL("../../packages/theme-authoring/dist/index.mjs", import.meta.url);
const { buildFrameworkTheme } = await import(authoringUrl.href);
const { startAuthoringServer } = await import(new URL("./dev.mjs", authoringUrl).href);
const { startExplorerServer } = await import(
  packageRoot
    ? pathToFileURL(path.join(packageRoot, "node_modules/@dirwell/server/dist/node.mjs")).href
    : new URL("../../packages/server/dist/node.mjs", import.meta.url).href
);
import { authoringFixture } from "../helpers/authoring.mjs";
for (const framework of ["svelte", "vue"]) {
  test(`${framework}: customized SSR/client navigation, search, live updates and teardown`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(90000);
    const fixture = await authoringFixture(framework);
    let server, nojs;
    try {
      const result = await buildFrameworkTheme({
        framework,
        component: fixture.component,
        output: fixture.output,
      });
      const { createTheme } = await import(result.themeUrl);
      server = await startExplorerServer({
        root: fixture.files,
        theme: createTheme({ title: "My files" }),
        live: { intervalMs: 50 },
      });
      nojs = await browser.newContext({ javaScriptEnabled: false });
      const staticPage = await nojs.newPage();
      await staticPage.goto(server.url + "/browse/");
      await expect(staticPage.locator("[data-custom-header]")).toContainText("My files");
      await expect(staticPage.locator("[data-custom-row]")).toHaveCount(2);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(server.url + "/browse/");
      const search = page.locator("input[type=search]").first();
      await expect(search).toBeEnabled();
      await search.fill("hello");
      await expect(page.locator("[data-custom-row]")).toHaveCount(1);
      await search.fill("");
      const action = page.locator("[data-custom-action]").first();
      await expect(page.locator("a [data-custom-action]")).toHaveCount(0);
      const beforeAction = page.url();
      await action.focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("[data-inspected]")).not.toBeEmpty();
      expect(page.url()).toBe(beforeAction);
      await page
        .locator("a")
        .filter({ has: page.locator("[data-custom-row]") })
        .filter({ hasText: "docs" })
        .click();
      await expect(page.locator("[data-custom-row]")).toHaveCount(1);
      await expect(page.locator("[data-custom-row]")).toContainText("nested.txt");
      await expect(page.locator("[data-custom-footer]")).toContainText("1 entries");
      await page.goBack();
      await expect(page.locator("[data-custom-row]")).toHaveCount(2);
      await search.fill("new-file");
      await writeFile(path.join(fixture.files, "new-file.txt"), "new");
      await expect(page.locator("[data-custom-row]")).toHaveCount(1);
      await expect(page.locator("[data-custom-row]")).toContainText("new-file");
      await page.evaluate(() => globalThis.__dirwellUnmount());
      await expect(search).toHaveCount(0);
      expect(errors).toEqual([]);
    } finally {
      if (nojs) await nojs.close();
      if (server) await server.close();
      await fixture.close();
    }
  });
  test(`${framework}: native source HMR, CSS, compiler error recovery and fresh SSR`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    const fixture = await authoringFixture(framework);
    let server;
    try {
      server = await startAuthoringServer({
        framework,
        component: fixture.component,
        explorer: { root: fixture.files, live: { intervalMs: 50 } },
      });
      await page.goto(server.url + "/browse/");
      const search = page.locator("input[type=search]").first();
      await expect(search).toBeEnabled();
      await search.fill("hello");
      await page.evaluate(() => (globalThis.__authoringDocument = "original"));
      const updated = fixture.source
        .replace("My archive", "Edited archive")
        .replace("My media", "Edited media");
      await writeFile(fixture.component, updated);
      await expect(page.locator("[data-custom-header]")).toContainText("Edited");
      await expect(search).toBeEnabled();
      expect(await page.evaluate(() => globalThis.__authoringDocument)).toBe("original");
      await search.fill("hello");
      const styled = updated.replace("#315b85", "#225533").replace("#f0d6ff", "#225533");
      await writeFile(fixture.component, styled);
      await expect(page.locator("[data-custom-header]")).toHaveCSS("color", "rgb(34, 85, 51)");
      await expect(search).toHaveValue("hello");
      expect(await (await fetch(server.url + "/browse/")).text()).toContain("Edited");
      await writeFile(
        fixture.component,
        framework === "svelte" ? "<script>invalid !!!</script>" : "<template><span></template>",
      );
      await expect(page.locator("vite-error-overlay")).toBeAttached();
      await writeFile(fixture.component, styled.replace("Edited", "Recovered"));
      await expect(page.locator("[data-custom-header]")).toContainText("Recovered");
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
      await search.fill("hello");
      await writeFile(path.join(fixture.files, "hello-live.txt"), "new");
      await expect(page.locator("[data-custom-row]")).toHaveCount(2);
      expect(await readFile(fixture.component, "utf8")).toContain("Recovered");
      await search.fill("");
      await page
        .locator("a")
        .filter({ has: page.locator("[data-custom-row]") })
        .filter({ hasText: "docs" })
        .click();
      await expect(page.locator("[data-custom-row]")).toHaveCount(1);
      await expect(page.locator("[data-custom-row]")).toContainText("nested.txt");
      await writeFile(fixture.component, styled.replace("Edited", "Folder edited"));
      await expect(page.locator("[data-custom-header]")).toContainText("Folder edited");
      await expect(page.locator("[data-custom-row]")).toHaveCount(1);
      await expect(page.locator("[data-custom-row]")).toContainText("nested.txt");
      await expect(page.locator("[data-custom-footer]")).toContainText("1 entries");
      await expect(page).toHaveURL(/browse\/docs\//);
      expect(await page.evaluate(() => globalThis.__authoringDocument)).toBe("original");
    } finally {
      if (server) await server.close();
      await fixture.close();
    }
  });
}
