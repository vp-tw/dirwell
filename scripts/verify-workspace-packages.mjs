import { workspacePackages } from "./workspace-packages.mjs";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trial = await mkdtemp(path.join(tmpdir(), "dirwell-packed-workspace-"));
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
  if (result.status !== 0)
    throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const names = workspacePackages;
const tarballs = [];
let version;
for (const name of names) {
  const folder = path.join(repo, "packages", name);
  const manifest = JSON.parse(await readFile(path.join(folder, "package.json"), "utf8"));
  version ??= manifest.version;
  assert.equal(manifest.version, version, "Official SDK versions must remain synchronized");
  assert.match(version, /^0\.0\.\d+-alpha(?:\.(?:0|[1-9]\d*))?$/);
  assert.ok(manifest.private === undefined || typeof manifest.private === "boolean");
  const tarball = path.join(trial, `dirwell-${name}-${manifest.version}.tgz`);
  run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["pack", "--out", tarball], folder);
  tarballs.push(tarball);
}
const lightweight = path.join(trial, "lightweight");
await mkdir(lightweight);
await writeFile(
  path.join(lightweight, "package.json"),
  JSON.stringify({ private: true, type: "module" }),
);
run(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs.slice(0, 2)],
  lightweight,
);
const lightLock = JSON.parse(await readFile(path.join(lightweight, "package-lock.json"), "utf8"));
assert.deepEqual(
  Object.keys(lightLock.packages)
    .filter((name) => name)
    .sort(),
  ["node_modules/@dirwell/core", "node_modules/@dirwell/theme-plain", "node_modules/picomatch"],
);
await writeFile(
  path.join(lightweight, "consumer.mjs"),
  `import {generateExplorer} from '@dirwell/core';import {createPlainTheme} from '@dirwell/theme-plain';import {mkdir,writeFile,readFile} from 'node:fs/promises';import assert from 'node:assert/strict';await mkdir('files');await writeFile('files/note.txt','file');await generateExplorer({sourceDir:'files',outputDir:'out',theme:createPlainTheme()});assert.doesNotMatch(await readFile('out/index.html','utf8'),/<script|og:image/);`,
);
run(process.execPath, ["consumer.mjs"], lightweight);
await writeFile(
  path.join(trial, "package.json"),
  JSON.stringify({ private: true, type: "module" }),
);
run(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs],
  trial,
);
await writeFile(
  path.join(trial, "consumer.mjs"),
  await readFile(new URL("./workspace-consumer.mjs", import.meta.url), "utf8"),
);
await writeFile(
  path.join(trial, "diagnose-file-identity.mjs"),
  await readFile(new URL("./diagnose-file-identity.mjs", import.meta.url), "utf8"),
);
const reports = [process.execPath, ...process.argv.slice(2)].map((executable) =>
  JSON.parse(run(executable, ["consumer.mjs"], trial)),
);
const report = {
  checkedAt: new Date().toISOString(),
  trial,
  tarballs,
  lightweightDependencies: ["@dirwell/core", "@dirwell/theme-plain", "picomatch"],
  reports,
  limits: [
    "Local packed artifacts; no registry publication.",
    "Other platforms and the declared minimum Node version require independent qualification.",
    "Retained historical snapshots, distributed caching, hostile filesystem mutation and production load are not qualified.",
  ],
};
await writeFile(path.join(trial, "verification.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
