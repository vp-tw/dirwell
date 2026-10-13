// Copied into a disposable installed-package consumer by verify-platform.mjs.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { release } from "node:os";
import {
  generateExplorer,
  createDefaultTheme,
  createPlainTheme,
  createCrosswaveTheme,
  createShareImage,
} from "@vp-tw/dirwell";

await mkdir("files/docs", { recursive: true });
await writeFile("files/a & 日本語.txt", "encoded content");
await writeFile("files/README.md", "readme");
await writeFile("files/docs/nested.txt", "nested");
for (const extension of ["mjs", "ts"]) {
  const filename = "dirwell.config." + extension;
  await writeFile(
    filename,
    `import {defineConfig,createPlainTheme} from '@vp-tw/dirwell';export default defineConfig(async ({command})=>({outDir:'config-${extension}',mirror:false,theme:createPlainTheme({project:{name:'Config '+command}})}));`,
  );
  execFileSync(process.execPath, ["node_modules/@vp-tw/dirwell/dist/bin.mjs", "build", "files"], {
    stdio: "inherit",
  });
  assert.match(await readFile("config-" + extension + "/index.html", "utf8"), /Config build/);
  await rm(filename);
}
for (const host of [
  "unplugin",
  "vite",
  "rollup",
  "rolldown",
  "webpack",
  "rspack",
  "rsbuild",
  "esbuild",
  "farm",
  "bun",
])
  await import("@vp-tw/dirwell/" + host);
console.log("MJS/TS async config and all adapter imports passed on " + process.version);
let fileSymlinks = "verified";
try {
  await symlink("README.md", "files/valid-link");
  await symlink("missing.txt", "files/broken-link");
} catch (error) {
  if (process.platform !== "win32" || error.code !== "EPERM") throw error;
  fileSymlinks = "unverified: runner denied symlink creation";
}
const images = {};
for (const [name, factory] of [
  ["ledger", createDefaultTheme],
  ["plain", createPlainTheme],
  ["crosswave", createCrosswaveTheme],
]) {
  const image = await createShareImage({
    theme: name,
    title: "Platform consumer",
    description: "1 folder · 2 files",
  });
  const bytes = Buffer.from(await image.arrayBuffer());
  assert.equal(bytes.readUInt32BE(16), 1200);
  assert.equal(bytes.readUInt32BE(20), 630);
  images[name] = createHash("sha256").update(bytes).digest("hex");
  for (const mode of ["ssg", "mpa"]) {
    if (name === "plain") {
      const minimalDir = `plain-${mode}-minimal`;
      await generateExplorer({
        sourceDir: "files",
        outputDir: minimalDir,
        mode,
        theme: factory(),
        mirror: false,
      });
      const minimal = await readFile(`${minimalDir}/index.html`, "utf8");
      assert.match(minimal, /<title>Index of \/<\/title>/);
      assert.doesNotMatch(minimal, /og:|twitter:|@font-face|<footer|<script/);
    }
    const outputDir = `${name}-${mode}`;
    await generateExplorer({
      sourceDir: "files",
      outputDir,
      mode,
      theme: factory(),
      metadata: {
        image: () => ({ source: image, outputPath: "og/cover.png" }),
      },
    });
    assert.equal(await readFile(`${outputDir}/a & 日本語.txt`, "utf8"), "encoded content");
    assert.match(await readFile(`${outputDir}/index.html`, "utf8"), /og:image/);
    assert.ok((await readFile(`${outputDir}/og/cover.png`)).length > 0);
    assert.match(await readFile(`${outputDir}/docs/index.html`, "utf8"), /nested.txt/);
    if (fileSymlinks === "verified")
      assert.match(await readFile(`${outputDir}/index.html`, "utf8"), /broken-link/);
  }
}
const cliPath = "node_modules/@vp-tw/dirwell/dist/bin.mjs";
const build = spawn(process.execPath, [cliPath, "build", "files", "-o", "cli-output"], {
  stdio: "inherit",
});
assert.equal(await new Promise((resolve) => build.once("exit", resolve)), 0);
const cli = spawn(
  process.execPath,
  [cliPath, "serve", "files", "-o", "serve-output", "--port", "0"],
  {
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let log = "";
cli.stdout.on("data", (chunk) => {
  log += chunk;
});
cli.stderr.on("data", (chunk) => {
  log += chunk;
});
const exited = new Promise((resolve) => cli.once("exit", resolve));
async function wait(predicate) {
  for (let i = 0; i < 150; i++) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Platform consumer timed out. CLI output: ${log}`);
}
try {
  await wait(() => /Local:\s+https?:\/\//.test(log));
  const url = log.match(/Local:\s+(https?:\/\/\S+)/)[1];
  assert.match(await (await fetch(url)).text(), /README.md/);
  await writeFile("files/live.txt", "watch update");
  await wait(async () => {
    const response = await fetch(url);
    return response.ok && (await response.text()).includes("live.txt");
  });
  // Separate requests can straddle another watch rebuild; qualify eventual byte delivery.
  await wait(async () => {
    const response = await fetch(new URL("live.txt", url));
    return response.ok && (await response.text()) === "watch update";
  });
  await writeFile("files/live.txt", "changed content");
  await wait(async () => {
    const response = await fetch(new URL("live.txt", url));
    return response.ok && (await response.text()) === "changed content";
  });
  await rm("files/live.txt");
  await wait(async () => {
    const response = await fetch(url);
    return response.ok && !(await response.text()).includes("live.txt");
  });
} finally {
  cli.kill("SIGTERM");
  await exited;
}
const metadata = JSON.parse(await readFile("node_modules/@vp-tw/dirwell/package.json", "utf8"));
const report = {
  version: metadata.version,
  platform: process.platform,
  arch: process.arch,
  os: release(),
  node: process.version,
  images,
  fileSymlinks,
  checks: [
    "MJS/TS async config",
    "all adapter entry-point imports",
    "three themes × SSG/MPA",
    "native share images",
    "encoded filenames",
    "CLI build/serve",
    "live creation/modification/deletion",
  ],
  passed: true,
};
await writeFile("report.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
