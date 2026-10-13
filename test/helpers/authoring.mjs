import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
export async function authoringFixture(framework) {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-authoring-"));
  const repo = fileURLToPath(new URL("../../", import.meta.url));
  await mkdir(path.join(root, "node_modules/@dirwell"), { recursive: true });
  for (const name of ["core", "server", "theme-ledger", "theme-crosswave", "theme-authoring"])
    await symlink(
      path.join(
        process.env.DIRWELL_AUTHORING_CONSUMER_ROOT
          ? path.join(process.env.DIRWELL_AUTHORING_CONSUMER_ROOT, "node_modules/@dirwell")
          : path.join(repo, "packages"),
        name,
      ),
      path.join(root, "node_modules/@dirwell", name),
      process.platform === "win32" ? "junction" : "dir",
    );
  const component = path.join(root, framework === "svelte" ? "Ledger.svelte" : "Crosswave.vue");
  const source = await readFile(
    path.join(repo, "examples/authoring", path.basename(component)),
    "utf8",
  );
  await writeFile(component, source);
  const files = path.join(root, "files");
  await mkdir(path.join(files, "docs"), { recursive: true });
  await writeFile(path.join(files, "docs/nested.txt"), "nested");
  await writeFile(path.join(files, "hello.txt"), "hello");
  return {
    root,
    component,
    files,
    source,
    output: path.join(root, "compiled"),
    close: () => rm(root, { recursive: true, force: true }),
  };
}
