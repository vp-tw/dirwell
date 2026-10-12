import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { validateManifest, artifactDirectory } from "./workspace-release.mjs";
const manifest = JSON.parse(await readFile(path.join(artifactDirectory, "manifest.json"), "utf8"));
validateManifest(manifest, process.env);
const trial = await mkdtemp(path.join(tmpdir(), "dirwell-registry-consumer-"));
await writeFile(
  path.join(trial, "package.json"),
  JSON.stringify({ private: true, type: "module" }),
);
execFileSync(
  "npm",
  [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...manifest.packages.map((item) => `${item.metadata.name}@${manifest.version}`),
  ],
  { cwd: trial, stdio: "inherit" },
);
const lock = JSON.parse(await readFile(path.join(trial, "package-lock.json"), "utf8"));
for (const item of manifest.packages)
  assert.equal(lock.packages["node_modules/" + item.metadata.name].integrity, item.integrity);
execFileSync("npm", ["audit", "signatures"], { cwd: trial, stdio: "inherit" });
await writeFile(
  path.join(trial, "consumer.mjs"),
  await readFile(new URL("./workspace-consumer.mjs", import.meta.url), "utf8"),
);
await writeFile(
  path.join(trial, "diagnose-file-identity.mjs"),
  await readFile(new URL("./diagnose-file-identity.mjs", import.meta.url), "utf8"),
);
execFileSync(process.execPath, ["consumer.mjs"], { cwd: trial, stdio: "inherit" });
console.log("Verified registry integrity, signatures, provenance and installed behavior");
