import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("API reference covers every core export", async () => {
  const entrypoint = await readFile(path.join(root, "packages/core/src/index.ts"), "utf8");
  const reference = await readFile(
    path.join(root, "docs/src/content/docs/api-reference.mdx"),
    "utf8",
  );
  const names = [...entrypoint.matchAll(/export(?: type)?\s*\{([^}]+)\}/gs)].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map(
        (name) =>
          name
            .trim()
            .split(/\s+as\s+/)
            .at(-1) ?? "",
      )
      .filter(Boolean),
  );

  assert.ok(names.length > 0);
  for (const name of names) assert.ok(reference.includes(`\`${name}\``), `${name} is undocumented`);
});

test("published API examples type-check against SDK exports", () => {
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "-p",
      "docs/examples/tsconfig.json",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});
