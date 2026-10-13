import { startExplorerServer } from "@dirwell/server/node";
import { createPlainTheme } from "@dirwell/theme-plain";
const server = await startExplorerServer({ root: "files", theme: createPlainTheme(), port: 0 });
console.log(server.url);
await server.close();
