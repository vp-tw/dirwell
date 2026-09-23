import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputs = [path.join(root, "src"), path.join(root, "examples")];
let server: ChildProcess | undefined;
let building = false;
let pending = false;
let stopped = false;
let debounce: ReturnType<typeof setTimeout> | undefined;

function buildExamples(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "scripts/build-examples.ts")], {
      cwd: root,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Example build exited with code ${code ?? "unknown"}`));
    });
  });
}

async function rebuild(): Promise<void> {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  do {
    pending = false;
    try {
      await buildExamples();
      console.info("Examples updated. The documentation preview will reload automatically.");
    } catch (error) {
      console.error(error);
    }
  } while (pending && !stopped);
  building = false;
}

await buildExamples();

const watcher = chokidar.watch(inputs, {
  ignoreInitial: true,
  ignored: [/(^|[/\\])node_modules([/\\]|$)/, /(^|[/\\])\.dirwell([/\\]|$)/],
});

watcher.on("all", () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => void rebuild(), 150);
});
watcher.on("error", (error) => console.error("Example watcher failed:", error));

// Astro backgrounds `dev` automatically for agent sessions; keep it attached to
// this watcher so one process owns both lifecycles.
const astroArgs = ["--dir", "docs", "exec", "astro", "dev", "--ignore-lock"];
if (process.env.HOST) astroArgs.push("--host", process.env.HOST);
if (process.env.PORT) astroArgs.push("--port", process.env.PORT);
server = spawn("pnpm", astroArgs, { cwd: root, stdio: "inherit" });
server.once("error", (error) => {
  console.error("Documentation server failed:", error);
  void watcher.close();
  process.exitCode = 1;
});
server.once("exit", (code) => {
  stopped = true;
  clearTimeout(debounce);
  void watcher.close();
  process.exitCode = code ?? 1;
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stopped = true;
    clearTimeout(debounce);
    void watcher.close();
    server?.kill(signal);
  });
}
