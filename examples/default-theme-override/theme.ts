import path from "node:path";
import { readFile } from "node:fs/promises";
import { buildFrameworkTheme } from "@dirwell/theme-authoring";
import type { ExplorerTheme } from "@dirwell/core";

/** Compile into a caller-owned directory; active renderers must retain their paired output. */
export async function createCatppuccinTheme(output: string): Promise<ExplorerTheme> {
  const compiled = await buildFrameworkTheme({
    framework: "svelte",
    component: path.join(import.meta.dirname, "Ledger.svelte"),
    output,
  });
  const { createTheme } = await import(compiled.themeUrl);
  const native = createTheme({ title: "Sample downloads" }) as ExplorerTheme;
  const notice = await readFile(new URL("./icons/LICENSE", import.meta.url), "utf8");
  return {
    ...native,
    async render(context) {
      const page = await native.render(context);
      return { ...page, assets: { ...page.assets, "theme-icons-NOTICE.txt": notice } };
    },
  };
}
