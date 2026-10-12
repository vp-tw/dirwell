#!/usr/bin/env node
import { runCli } from "./index.ts";
try {
  const server = await runCli(process.argv.slice(2));
  if (server !== null) {
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      try {
        await server.close();
      } catch (error) {
        console.error(error instanceof Error ? error.message : "Shutdown failed");
        process.exitCode = 1;
      }
    };
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Dirwell failed");
  process.exitCode = 1;
}
