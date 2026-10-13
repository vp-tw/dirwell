import { generateExplorer, type GenerateOptions } from "@dirwell/core";
import { createPlainTheme } from "@dirwell/theme-plain";
export const options: GenerateOptions = {
  sourceDir: "files",
  outputDir: "generated",
  theme: createPlainTheme(),
  listing: ({ visibleCount }) => ({
    html: visibleCount > 500 ? { strategy: "paged", pageSize: 100 } : { strategy: "all" },
    data: { strategy: "all" },
  }),
  outputName: (directory) =>
    directory.entries.some((entry) => entry.name === "index.html") ? null : "index.html",
  symlinks: { follow: true, boundary: "root", onCycle: "skip" },
};
await generateExplorer(options);
