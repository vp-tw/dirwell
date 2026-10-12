import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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
const names = ["core", "theme-plain", "server", "theme-ledger", "theme-crosswave", "cli"];
const tarballs = [];
for (const name of names) {
  const folder = path.join(repo, "packages", name);
  const manifest = JSON.parse(await readFile(path.join(folder, "package.json"), "utf8"));
  assert.equal(manifest.version, "0.0.1-alpha");
  assert.equal(typeof manifest.private, "boolean");
  const tarball = path.join(trial, `dirwell-${name}-${manifest.version}.tgz`);
  run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["pack", "--out", tarball], folder);
  tarballs.push(tarball);
}
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
  reports,
  limits: [
    "Local private tarballs; no registry publication.",
    "Other platforms and the declared minimum Node version require independent qualification.",
    "Retained historical snapshots, distributed caching, hostile filesystem mutation and production load are not qualified.",
  ],
};
await writeFile(path.join(trial, "verification.json"), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
