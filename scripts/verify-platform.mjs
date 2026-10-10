import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const input = process.argv[2];
assert.ok(input, "Pass a package tarball or an exact published version");
const packageSource = input.endsWith(".tgz")
  ? path.resolve(input)
  : (assert.match(input, /^\d+\.\d+\.\d+(?:-alpha\.\d+)?$/), `@vp-tw/dirwell@${input}`);
const temporary = await mkdtemp(path.join(tmpdir(), "dirwell-platform-"));
const reportDir = path.resolve(process.argv[3] ?? ".platform-proof");
const name = process.env.PLATFORM_PROOF_NAME ?? `${process.platform}-${process.arch}`;
assert.match(name, /^[a-z0-9-]+$/);
const candidates = [
  path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
  path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
];
const npmCli = (
  await Promise.all(
    candidates.map(async (candidate) => {
      try {
        return (await stat(candidate)).isFile() ? candidate : null;
      } catch {
        return null;
      }
    }),
  )
).find(Boolean);
assert.ok(npmCli, "Cannot locate npm bundled with the selected Node installation");
try {
  await writeFile(
    path.join(temporary, "package.json"),
    JSON.stringify({
      name: "dirwell-platform-consumer",
      private: true,
      type: "module",
    }),
  );
  execFileSync(
    process.execPath,
    [npmCli, "install", "--ignore-scripts", "--no-audit", "--no-fund", packageSource],
    {
      cwd: temporary,
      stdio: "inherit",
    },
  );
  await cp(path.join(root, "scripts/platform-consumer.mjs"), path.join(temporary, "proof.mjs"));
  execFileSync(process.execPath, ["proof.mjs"], { cwd: temporary, stdio: "inherit" });
  const report = JSON.parse(await readFile(path.join(temporary, "report.json"), "utf8"));
  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, `${name}.json`), JSON.stringify(report, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
