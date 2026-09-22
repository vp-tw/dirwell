import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface DaemonState {
  readonly directory: string;
  readonly logFile: string;
  readonly pid: number;
  readonly startedAt: string;
}

function statePaths(cwd: string): { directory: string; log: string; state: string } {
  const directory = path.join(cwd, ".dirwell");
  return {
    directory,
    log: path.join(directory, "daemon.log"),
    state: path.join(directory, "daemon.json"),
  };
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function readDaemonState(cwd: string): Promise<DaemonState | null> {
  const { state } = statePaths(cwd);
  try {
    const value: unknown = JSON.parse(await readFile(state, "utf8"));
    if (typeof value !== "object" || value === null) return null;
    const candidate = value as Partial<DaemonState>;
    if (
      typeof candidate.pid !== "number" ||
      typeof candidate.directory !== "string" ||
      typeof candidate.logFile !== "string" ||
      typeof candidate.startedAt !== "string"
    ) {
      return null;
    }
    return candidate as DaemonState;
  } catch {
    return null;
  }
}

export async function daemonStatus(cwd: string): Promise<{
  readonly running: boolean;
  readonly state: DaemonState | null;
}> {
  const state = await readDaemonState(cwd);
  return { running: state !== null && isRunning(state.pid), state };
}

export async function startDaemon(options: {
  readonly base?: string;
  readonly binPath: string;
  readonly cwd: string;
  readonly directory: string;
  readonly host?: string;
  readonly mode?: string;
  readonly outDir?: string;
  readonly port?: string;
  readonly urls?: string;
}): Promise<DaemonState> {
  const current = await daemonStatus(options.cwd);
  if (current.running && current.state !== null) {
    throw new Error(`Dirwell daemon is already running with PID ${current.state.pid}`);
  }

  const paths = statePaths(options.cwd);
  await mkdir(paths.directory, { recursive: true });
  const args = [options.binPath, "serve", options.directory, "--cwd", options.cwd];
  if (options.base !== undefined) args.push("--base", options.base);
  if (options.host !== undefined) args.push("--host", options.host);
  if (options.mode !== undefined) args.push("--mode", options.mode);
  if (options.outDir !== undefined) args.push("--outDir", options.outDir);
  if (options.port !== undefined) args.push("--port", options.port);
  if (options.urls !== undefined) args.push("--urls", options.urls);

  const logDescriptor = openSync(paths.log, "a");
  const child = spawn(process.execPath, args, {
    cwd: options.cwd,
    detached: true,
    env: { ...process.env, DIRWELL_DAEMON: "1" },
    stdio: ["ignore", logDescriptor, logDescriptor],
  });
  closeSync(logDescriptor);
  if (child.pid === undefined) throw new Error("Failed to start Dirwell daemon");
  child.unref();

  await new Promise((resolve) => setTimeout(resolve, 150));
  if (!isRunning(child.pid)) {
    throw new Error(`Dirwell daemon exited during startup; inspect ${paths.log}`);
  }

  const state: DaemonState = {
    directory: path.resolve(options.cwd, options.directory),
    logFile: paths.log,
    pid: child.pid,
    startedAt: new Date().toISOString(),
  };
  await writeFile(paths.state, `${JSON.stringify(state, null, 2)}\n`);
  return state;
}

export async function stopDaemon(cwd: string): Promise<DaemonState | null> {
  const status = await daemonStatus(cwd);
  if (status.state === null) return null;
  if (status.running) process.kill(status.state.pid, "SIGTERM");
  await rm(statePaths(cwd).state, { force: true });
  return status.state;
}
