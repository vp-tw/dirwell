import { lstat, readdir, readFile, realpath, rename, rm, mkdir, open } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isInsideRoot } from "./filesystem.ts";

export const outputMarker = "__dirwell/ownership.json";
export const outputMarkerContents = '{"type":"dirwell-output","version":1}\n';

export async function lockOutput(output: string) {
  const canonical = await canonicalPath(output);
  const lockPath = path.join(path.dirname(canonical), `.${path.basename(canonical)}-dirwell.lock`);
  await mkdir(path.dirname(lockPath), { recursive: true });
  let handle;
  try {
    handle = await open(lockPath, "wx");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST")
      throw new Error(
        `Output is locked by another build: ${lockPath}. Wait for it to finish. Remove a stale lock only after confirming its owner has stopped; --force does not bypass locks.`,
      );
    throw error;
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid }));
  } catch (error) {
    await handle.close();
    await rm(lockPath);
    throw error;
  }
  return {
    lockPath,
    async release() {
      await handle.close();
      await rm(lockPath);
    },
  };
}

export async function canonicalPath(filename: string): Promise<string> {
  try {
    return await realpath(filename);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    const parent = path.dirname(filename);
    if (parent === filename) throw error;
    return path.join(await canonicalPath(parent), path.basename(filename));
  }
}

/** Force permits output ownership replacement, never source containment violations. */
export async function checkOutput(
  source: string,
  output: string,
  policy: "owned" | "replace" = "owned",
): Promise<boolean> {
  if (policy !== "owned" && policy !== "replace")
    throw new TypeError("outputPolicy must be owned or replace");
  if (isInsideRoot(await canonicalPath(output), await realpath(source)))
    throw new Error("outputDir must not contain the sourceDir");
  let stat;
  try {
    stat = await lstat(output);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
  if (stat.isSymbolicLink() || !stat.isDirectory())
    throw new Error("outputDir must be a directory, not a file or symlink");
  if ((await readdir(output)).length === 0 || policy === "replace") return true;
  try {
    const marker = path.join(output, outputMarker);
    if (
      !(await lstat(path.dirname(marker))).isSymbolicLink() &&
      !(await lstat(marker)).isSymbolicLink() &&
      (await readFile(marker, "utf8")) === outputMarkerContents
    )
      return true;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  throw new Error(
    "Output is nonempty and not owned by Dirwell. Choose another directory or explicitly replace it with --force (-f) / outputPolicy: 'replace'.",
  );
}

/** Keep a recoverable previous tree until the new tree is installed. */
export async function publishOutput(
  staged: string,
  output: string,
  source: string,
  policy: "owned" | "replace" = "owned",
): Promise<void> {
  const exists = await checkOutput(source, output, policy);
  await mkdir(path.dirname(output), { recursive: true });
  const backup = path.join(
    path.dirname(output),
    `.${path.basename(output)}-previous-${randomUUID()}`,
  );
  if (exists) await rename(output, backup);
  try {
    await rename(staged, output);
  } catch (error) {
    if (exists) {
      try {
        await rename(backup, output);
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          `Publication failed; previous output is retained at ${backup}`,
        );
      }
    }
    throw error;
  }
  if (exists) await rm(backup, { recursive: true, force: true });
}
