import { spawn, execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";
import { createServer } from "vite-upstream";
import dirwellVite from "../../src/vite.ts";
import { createCrosswaveTheme } from "../../src/theme-crosswave.ts";
import { createRsbuild } from "@rsbuild/core";
import unplugin from "../../src/unplugin.ts";
function serverEnv() {
  const environment = { ...process.env, PORT: "0" };
  delete environment.PORTLESS_URL;
  return environment;
}
const cli = new URL("../../src/bin.ts", import.meta.url).pathname;
async function source() {
  const root = await mkdtemp(path.join(tmpdir(), "cw-host-browser-"));
  await mkdir(path.join(root, "files/Albums"), { recursive: true });
  await writeFile(path.join(root, "files/Albums/inside.txt"), "inside");
  await writeFile(path.join(root, "index.html"), "<h1>Host</h1>");
  await writeFile(path.join(root, "entry.js"), "console.log('host');");
  await writeFile(
    path.join(root, "dirwell.config.ts"),
    `import {createCrosswaveTheme} from ${JSON.stringify(new URL("../../src/theme-crosswave.ts", import.meta.url).pathname)}; export default {theme:createCrosswaveTheme()};`,
  );
  return root;
}
async function browse(page, url) {
  await page.goto(url);
  await page.evaluate(() => {
    window.__cwCanvas = document.querySelector("#cw-wave");
  });
  await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
  await expect(page.getByRole("link", { name: /inside\.txt/ })).toBeVisible();
  expect(await page.evaluate(() => window.__cwCanvas === document.querySelector("#cw-wave"))).toBe(
    true,
  );
  await page.getByRole("link", { name: "Parent directory", exact: true }).click();
  await expect(page).toHaveURL(url);
}
function serving(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`CLI startup timed out: ${output}`)), 8000);
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const url = output.match(/Local: (http:\/\/[^\s]+)/)?.[1];
      if (url) {
        clearTimeout(timer);
        resolve(url);
      }
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`CLI exited ${code}: ${output}`));
    });
  });
}
for (const mode of ["ssg", "mpa"])
  test(`CLI ${mode} build and serve preserve Crosswave navigation after a rebuild`, async ({
    page,
  }) => {
    const root = await source();
    let child;
    try {
      await promisify(execFile)(process.execPath, [
        cli,
        "build",
        "files",
        "--cwd",
        root,
        "--mode",
        mode,
        "-o",
        "built",
      ]);
      const html = await readFile(path.join(root, "built/Albums/index.html"), "utf8");
      expect(html).toContain("data-cw-page=");
      child = spawn(
        process.execPath,
        [cli, "serve", "files", "--cwd", root, "--mode", mode, "--port", "0", "-o", "preview"],
        { stdio: ["ignore", "pipe", "pipe"], env: serverEnv() },
      );
      const url = await serving(child);
      await browse(page, url);
      await writeFile(path.join(root, "files/Albums/added.txt"), "added");
      await expect
        .poll(async () => (await page.request.get(new URL("Albums/", url).href)).text())
        .toContain("added.txt");
      await page.getByRole("link", { name: /Albums\/ Folder/ }).click();
      await expect(page.getByRole("link", { name: /added\.txt/ })).toBeVisible();
    } finally {
      if (child && child.exitCode === null) {
        const ended = new Promise((resolve) => child.once("exit", resolve));
        child.kill("SIGTERM");
        await ended;
      }
      await rm(root, { recursive: true, force: true });
    }
  });
test("CLI daemon serves the same navigation assets and stops cleanly", async ({ page }) => {
  const root = await source();
  let started = false;
  try {
    await promisify(execFile)(
      process.execPath,
      [cli, "daemon", "start", "files", "--cwd", root, "--port", "0"],
      { env: serverEnv() },
    );
    started = true;
    let url;
    await expect
      .poll(async () => {
        const log = await readFile(path.join(root, ".dirwell/daemon.log"), "utf8");
        url = log.match(/Local: (http:\/\/[^\s]+)/)?.[1];
        return Boolean(url);
      })
      .toBe(true);
    await browse(page, url);
  } finally {
    if (started)
      await promisify(execFile)(process.execPath, [cli, "daemon", "stop", "--cwd", root]);
    await rm(root, { recursive: true, force: true });
  }
});
for (const mode of ["ssg", "mpa"])
  test(`Vite ${mode} under a deployment base delivers persistent navigation`, async ({ page }) => {
    const root = await source();
    let server;
    try {
      server = await createServer({
        root,
        configFile: false,
        base: "/app/",
        logLevel: "silent",
        plugins: [dirwellVite({ root: "files", mode, theme: createCrosswaveTheme() })],
        server: { host: "127.0.0.1", port: 0 },
      });
      await server.listen();
      const url = new URL("dirwell/", server.resolvedUrls.local[0]).href;
      await browse(page, url);
    } finally {
      await server?.close();
      await rm(root, { recursive: true, force: true });
    }
  });
test("Rsbuild native dev server delivers directory data for persistent navigation", async ({
  page,
}) => {
  const root = await source();
  let server;
  try {
    const rsbuild = await createRsbuild({
      cwd: root,
      rsbuildConfig: {
        source: { entry: { index: "./entry.js" } },
        server: { host: "127.0.0.1", port: 0, open: false },
        performance: { printFileSize: false },
        plugins: [unplugin.rsbuild({ root: "files", theme: createCrosswaveTheme() })],
      },
    });
    server = await rsbuild.createDevServer();
    const { urls } = await server.listen();
    await browse(page, new URL("dirwell/", urls[0]).href);
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});
