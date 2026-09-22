#!/usr/bin/env node
import { runMain } from "citty";
import { mainCommand } from "./cli.ts";

const rawArgs = process.argv.slice(2);
const firstArgument = rawArgs[0];
const knownCommands = new Set(["build", "daemon", "dev", "serve"]);
const normalizedArgs =
  firstArgument !== undefined && !firstArgument.startsWith("-") && !knownCommands.has(firstArgument)
    ? ["serve", ...rawArgs]
    : rawArgs;

await runMain(mainCommand, { rawArgs: normalizedArgs });
