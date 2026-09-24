import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examples = [
  "basic",
  "base",
  "custom-theme",
  "default-theme-override",
  "file-icons",
  "plain",
] as const;

for (const example of examples) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        path.join(root, "src/bin.ts"),
        "build",
        "files",
        "--cwd",
        path.join(root, "examples", example),
      ],
      {
        cwd: root,
        env: {
          ...process.env,
          DIRWELL_SITE_BASE: process.env.SITE_BASE ?? "/",
        },
        stdio: "inherit",
      },
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Example ${example} exited with code ${code ?? "unknown"}`));
    });
  });
}

await writeFile(path.join(root, "docs/public/examples/.build-id"), randomUUID());
