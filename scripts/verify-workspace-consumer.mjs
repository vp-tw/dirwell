import { mkdtemp, readdir, readFile, writeFile, access, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const directory = path.resolve(process.argv[2]);
const tarballs = (await readdir(directory))
  .filter((name) => name.endsWith(".tgz"))
  .map((name) => path.join(directory, name));
if (tarballs.length !== 6) throw new Error("Expected all six workspace tarballs");
const trial = await mkdtemp(path.join(tmpdir(), "dirwell-platform-workspace-"));
await writeFile(
  path.join(trial, "package.json"),
  JSON.stringify({ private: true, type: "module" }),
);
function run(command, args) {
  const result = spawnSync(command, args, { cwd: trial, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stdout + "\n" + result.stderr);
  return result.stdout;
}
// Use npm's JavaScript entry to avoid invoking a Windows command shell.
let npmCli;
for (const candidate of [
  path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
  path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
]) {
  try {
    await access(candidate);
    npmCli = candidate;
    break;
  } catch {
    /* Try the other official Node distribution layout. */
  }
}
if (!npmCli) throw new Error("Cannot find the npm CLI shipped with Node");
run(process.execPath, [
  npmCli,
  "install",
  "--ignore-scripts",
  "--no-audit",
  "--no-fund",
  ...tarballs,
]);
await writeFile(
  path.join(trial, "consumer.mjs"),
  await readFile(new URL("./workspace-consumer.mjs", import.meta.url), "utf8"),
);
const proof = JSON.parse(run(process.execPath, ["consumer.mjs"]));
const output = path.resolve(".workspace-platform-proof");
await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, (process.env.PLATFORM_PROOF_NAME ?? "local") + ".json"),
  JSON.stringify(proof, null, 2) + "\n",
);
console.log(JSON.stringify(proof, null, 2));
