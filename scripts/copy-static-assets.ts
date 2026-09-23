import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");

await mkdir(output, { recursive: true });
await Promise.all([
  cp(path.join(root, "src/theme-runtime.js"), path.join(output, "theme-runtime.js")),
  cp(path.join(root, "src/theme-worker.js"), path.join(output, "theme-worker.js")),
  cp(path.join(root, "src/vscode-icons"), path.join(output, "vscode-icons"), {
    recursive: true,
  }),
]);
