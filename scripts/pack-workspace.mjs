import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  destination = path.resolve(process.argv[2] ?? "workspace-artifact");
await mkdir(destination, { recursive: true });
const packages = [];
for (const name of ["core", "theme-plain", "server", "theme-ledger", "theme-crosswave", "cli"]) {
  const folder = path.join(repo, "packages", name),
    manifest = JSON.parse(await readFile(path.join(folder, "package.json"), "utf8"));
  const filename = `dirwell-${name}-${manifest.version}.tgz`;
  const packed = spawnSync("pnpm", ["pack", "--out", path.join(destination, filename)], {
    cwd: folder,
    encoding: "utf8",
  });
  if (packed.status !== 0) throw new Error(packed.stdout + "\n" + packed.stderr);
  packages.push({ name: manifest.name, version: manifest.version, filename });
}
await writeFile(path.join(destination, "packages.json"), JSON.stringify(packages, null, 2) + "\n");
console.log(`Packed ${packages.length} workspace packages into ${destination}`);
