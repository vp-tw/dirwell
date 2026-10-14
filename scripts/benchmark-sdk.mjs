import { mkdtemp, mkdir, writeFile, readFile, readdir, stat, rm } from "node:fs/promises";
import { tmpdir, cpus, totalmem, platform, release } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: {
    consumer: { type: "string" },
    counts: { type: "string", default: "1000,10000" },
    report: { type: "string" },
    keep: { type: "boolean", default: false },
  },
});
const consumer = values.consumer
  ? path.resolve(values.consumer)
  : path.resolve(import.meta.dirname, "..");
const packageEntry = (name) =>
  pathToFileURL(
    path.join(
      consumer,
      values.consumer ? "node_modules/@dirwell" : "packages",
      name,
      "dist/index.mjs",
    ),
  ).href;
const root = await mkdtemp(path.join(tmpdir(), "dirwell-sdk-benchmark-"));
const require = createRequire(import.meta.url);
const { chromium } = require("@playwright/test");
const counts = values.counts.split(",").map(Number);
if (counts.some((count) => !Number.isSafeInteger(count) || count < 100 || count > 100000))
  throw new Error("counts must contain integers from 100 to 100000");
const themes = ["plain", "ledger", "crosswave"];
const browser = await chromium.launch();
const results = [];
let activeServer;
try {
  async function bytes(folder) {
    let total = 0;
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const filename = path.join(folder, entry.name);
      total += entry.isDirectory() ? await bytes(filename) : (await stat(filename)).size;
    }
    return total;
  }
  for (const count of counts) {
    const source = path.join(root, "files-" + count);
    await mkdir(source);
    for (let start = 0; start < count; start += 100)
      await Promise.all(
        Array.from({ length: Math.min(100, count - start) }, (_, offset) => {
          const index = start + offset;
          return writeFile(
            path.join(
              source,
              `artifact-${String(index).padStart(5, "0")}-long-release-notes-with-public-details.txt`,
            ),
            "ok",
          );
        }),
      );
    for (const theme of themes) {
      const output = path.join(root, theme + "-" + count);
      const worker = path.join(root, "worker.mjs");
      await writeFile(
        worker,
        `import {generateExplorer} from ${JSON.stringify(packageEntry("core"))};import {create${theme[0].toUpperCase() + theme.slice(1)}Theme as createTheme} from ${JSON.stringify(packageEntry("theme-" + theme))};const start=performance.now();await generateExplorer({sourceDir:${JSON.stringify(source)},outputDir:${JSON.stringify(output)},mirror:false,theme:createTheme(),listing:{html:{strategy:'paged',pageSize:100},data:{strategy:'blocks',blockSize:1000}}});console.log(JSON.stringify({buildMs:performance.now()-start,maxRssKiB:process.resourceUsage().maxRSS}));`,
      );
      const build = await new Promise((resolve, reject) => {
        const p = spawn(process.execPath, [worker], { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "",
          stderr = "";
        p.stdout.on("data", (chunk) => (stdout += chunk));
        p.stderr.on("data", (chunk) => (stderr += chunk));
        p.on("exit", (code) =>
          code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)),
        );
      });
      const server = (activeServer = createServer(async (req, res) => {
        try {
          let filename = path.resolve(
            output,
            "." + decodeURIComponent(new URL(req.url, "http://test").pathname),
          );
          if (filename !== output && !filename.startsWith(output + path.sep))
            throw new Error("Outside benchmark output");
          if ((await stat(filename)).isDirectory()) filename = path.join(filename, "index.html");
          const type = path.extname(filename);
          res.setHeader(
            "content-type",
            type === ".js"
              ? "text/javascript"
              : type === ".json"
                ? "application/json"
                : "text/html",
          );
          res.setHeader("cache-control", "no-store");
          res.end(await readFile(filename));
        } catch {
          res.writeHead(404).end();
        }
      }));
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const url = `http://127.0.0.1:${server.address().port}/`;
      const views = [];
      for (const viewport of [
        { width: 1280, height: 800 },
        { width: 390, height: 844 },
      ]) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const client = await context.newCDPSession(page);
        await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await client.send("Network.setCacheDisabled", { cacheDisabled: true });
        await client.send("Performance.enable");
        let transfer = 0;
        const responseTasks = [];
        page.on("response", (response) => {
          responseTasks.push(
            (async () => {
              if (response.ok())
                try {
                  transfer += (await response.body()).length;
                } catch {}
            })(),
          );
        });
        const start = performance.now();
        await page.goto(url);
        if (theme !== "plain")
          await page.locator("input[type=search]").first().waitFor({ state: "visible" });
        if (theme !== "plain")
          await page.waitForFunction(() => !document.querySelector("input[type=search]")?.disabled);
        const readyMs = performance.now() - start;
        let filterMs = null,
          clearMs = null;
        if (theme !== "plain") {
          const search = page.locator("input[type=search]").first();
          const filterStart = performance.now();
          await search.fill("artifact-09999");
          await page.waitForFunction(() => {
            const rows = document.querySelectorAll("[data-order],.cw-files>.cw-row");
            return rows.length === 1 || document.body.textContent.includes("No matching entries.");
          });
          filterMs = performance.now() - filterStart;
          const clearStart = performance.now();
          await search.fill("");
          await page.waitForFunction(
            () => document.querySelectorAll("[data-order],.cw-files>.cw-row").length > 1,
          );
          clearMs = performance.now() - clearStart;
        }
        await Promise.all(responseTasks);
        const metrics = await client.send("Performance.getMetrics");
        views.push({
          viewport: viewport.width,
          readyMs,
          filterMs,
          clearMs,
          transferBytes: transfer,
          renderedRows: await page.locator("[data-order],.cw-files>.cw-row").count(),
          overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          scriptMs: (metrics.metrics.find((x) => x.name === "ScriptDuration")?.value ?? 0) * 1000,
          layoutMs: (metrics.metrics.find((x) => x.name === "LayoutDuration")?.value ?? 0) * 1000,
          jsHeapBytes: metrics.metrics.find((x) => x.name === "JSHeapUsedSize")?.value ?? null,
        });
        await context.close();
      }
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      results.push({
        theme,
        count,
        ...build,
        htmlBytes: (await stat(path.join(output, "index.html"))).size,
        outputBytes: await bytes(output),
        views,
      });
      process.stderr.write(JSON.stringify(results.at(-1)) + "\n");
    }
  }
  await browser.close();
  const report = {
    checkedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: platform(),
      os: release(),
      cpus: cpus().length,
      memoryBytes: totalmem(),
      browser: browser.version(),
    },
    consumer,
    root,
    results,
  };
  if (values.report) await writeFile(values.report, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
  if (!values.keep) await rm(root, { recursive: true, force: true });
} finally {
  if (activeServer?.listening) {
    activeServer.closeAllConnections();
    await new Promise((resolve) => activeServer.close(resolve));
  }
  await browser.close();
  if (!values.keep) await rm(root, { recursive: true, force: true });
}
