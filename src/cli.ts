import { defineCommand } from "citty";
import path from "node:path";
import { generateExplorer } from "./generator.ts";
import { createExplorerDevServer } from "./dev-server.ts";
import { loadDirwellConfig, resolveGenerateOptions } from "./config.ts";
import { daemonStatus, startDaemon, stopDaemon } from "./daemon.ts";
import packageMetadata from "../package.json" with { type: "json" };

const directoryArgument = {
  type: "positional" as const,
  description: "Directory to explore",
  default: ".",
};

const commonArguments = {
  directory: directoryArgument,
  base: {
    type: "string" as const,
    description: "Deployment base path or URL",
  },
  cwd: {
    type: "string" as const,
    description: "Directory used to discover dirwell.config.ts",
    default: ".",
  },
  mode: {
    type: "enum" as const,
    description: "Output mode",
    options: ["ssg", "mpa"],
  },
  urls: {
    type: "enum" as const,
    description: "Generated URL strategy",
    options: ["relative", "base", "html-base"],
  },
};

const serveArguments = {
  ...commonArguments,
  host: { type: "string" as const, description: "Listening host" },
  outDir: {
    type: "string" as const,
    alias: "o",
    description: "Preview output directory",
  },
  port: { type: "string" as const, alias: "p", description: "Listening port" },
};

interface ServeInputs {
  readonly base: string | undefined;
  readonly cwd: string;
  readonly directory: string;
  readonly host: string | undefined;
  readonly mode: string | undefined;
  readonly outDir: string | undefined;
  readonly port: string | undefined;
  readonly urls: string | undefined;
}

async function runServe(inputs: ServeInputs): Promise<void> {
  const cwd = pathFromProcess(inputs.cwd);
  const { config } = await loadDirwellConfig(cwd, "serve");
  const outputDir = inputs.outDir ?? config.outDir ?? ".dirwell-preview";
  const options = resolveGenerateOptions(cwd, config, {
    ...(inputs.base === undefined ? {} : { base: inputs.base }),
    root: inputs.directory,
    outDir: outputDir,
    ...(inputs.mode === undefined ? {} : { mode: inputs.mode as "mpa" | "ssg" }),
    ...(inputs.urls === undefined
      ? {}
      : { urls: inputs.urls as "base" | "html-base" | "relative" }),
  });
  const configuredPort = inputs.port ?? process.env.PORT;
  const port =
    configuredPort === undefined ? (config.server?.port ?? 4173) : Number(configuredPort);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new TypeError("port must be an integer between 0 and 65535");
  }
  const server = await createExplorerDevServer({
    ...options,
    host: inputs.host ?? process.env.HOST ?? config.server?.host ?? "127.0.0.1",
    port,
  });
  console.log(`Dirwell is watching ${options.sourceDir}`);
  console.log(`Local: ${process.env.PORTLESS_URL ?? server.url}`);
}

export const buildCommand = defineCommand({
  meta: { name: "build", description: "Generate a deployable static file explorer" },
  args: {
    ...commonArguments,
    outDir: {
      type: "string",
      alias: "o",
      description: "Output directory",
    },
  },
  async run({ args }) {
    const cwd = pathFromProcess(args.cwd);
    const { config } = await loadDirwellConfig(cwd, "build");
    const options = resolveGenerateOptions(cwd, config, {
      ...(args.base === undefined ? {} : { base: args.base }),
      root: args.directory,
      ...(args.outDir === undefined ? {} : { outDir: args.outDir }),
      ...(args.mode === undefined ? {} : { mode: args.mode as "mpa" | "ssg" }),
      ...(args.urls === undefined ? {} : { urls: args.urls as "base" | "html-base" | "relative" }),
    });
    await generateExplorer(options);
    console.log(`Built ${options.sourceDir} → ${options.outputDir}`);
  },
});

export const serveCommand = defineCommand({
  meta: {
    name: "serve",
    alias: "dev",
    description: "Watch files and serve the explorer with live reload",
  },
  args: serveArguments,
  async run({ args }) {
    await runServe(args);
  },
});

const daemonStartCommand = defineCommand({
  meta: { name: "start", description: "Start a detached file explorer server" },
  args: serveArguments,
  async run({ args }) {
    const cwd = pathFromProcess(args.cwd);
    const binPath = process.argv[1];
    if (binPath === undefined) throw new Error("Cannot resolve the Dirwell executable");
    const state = await startDaemon({
      binPath,
      cwd,
      directory: args.directory,
      ...(args.base === undefined ? {} : { base: args.base }),
      ...(args.host === undefined ? {} : { host: args.host }),
      ...(args.mode === undefined ? {} : { mode: args.mode }),
      ...(args.outDir === undefined ? {} : { outDir: args.outDir }),
      ...(args.port === undefined ? {} : { port: args.port }),
      ...(args.urls === undefined ? {} : { urls: args.urls }),
    });
    console.log(`Started Dirwell daemon with PID ${state.pid}`);
    console.log(`Log: ${state.logFile}`);
  },
});

const daemonStatusCommand = defineCommand({
  meta: { name: "status", description: "Show daemon status" },
  args: { cwd: commonArguments.cwd },
  async run({ args }) {
    const status = await daemonStatus(pathFromProcess(args.cwd));
    if (!status.running || status.state === null) {
      console.log("Dirwell daemon is not running");
      return;
    }
    console.log(`Dirwell daemon is running with PID ${status.state.pid}`);
    console.log(`Directory: ${status.state.directory}`);
    console.log(`Log: ${status.state.logFile}`);
  },
});

const daemonStopCommand = defineCommand({
  meta: { name: "stop", description: "Stop the detached file explorer server" },
  args: { cwd: commonArguments.cwd },
  async run({ args }) {
    const state = await stopDaemon(pathFromProcess(args.cwd));
    console.log(state === null ? "Dirwell daemon is not running" : `Stopped PID ${state.pid}`);
  },
});

export const daemonCommand = defineCommand({
  meta: { name: "daemon", description: "Manage a detached file explorer server" },
  default: "start",
  subCommands: {
    start: daemonStartCommand,
    status: daemonStatusCommand,
    stop: daemonStopCommand,
  },
});

export const mainCommand = defineCommand({
  meta: {
    name: "dirwell",
    version: packageMetadata.version,
    description: "Build and serve a static file explorer",
  },
  default: "serve",
  subCommands: {
    build: buildCommand,
    daemon: daemonCommand,
    serve: serveCommand,
  },
});

function pathFromProcess(value: string): string {
  return path.resolve(process.cwd(), value);
}
