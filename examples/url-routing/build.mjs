import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateExplorer } from "@dirwell/core";
import { createPlainTheme } from "@dirwell/theme-plain";
const [directoryUrls, output] = process.argv.slice(2);
if (!directoryUrls || !output)
  throw new Error(
    "Usage: node examples/url-routing/build.mjs explicit|slash|clean <dedicated-output>",
  );
const report = await generateExplorer({
  sourceDir: fileURLToPath(new URL("./files", import.meta.url)),
  outputDir: path.resolve(output),
  routing: { directoryUrls },
  theme: createPlainTheme(),
  listing: { html: { strategy: "paged", pageSize: 1 }, data: { strategy: "all" } },
});
console.log(JSON.stringify(report, null, 2));
