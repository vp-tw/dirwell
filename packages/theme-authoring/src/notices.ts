import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";
/** Preserve notices for dependencies bundled into either runtime. */
export function noticeCollector(notices: Map<string, string>): Plugin {
  return {
    name: "dirwell-bundle-notices",
    async generateBundle() {
      for (const id of this.getModuleIds()) {
        if (!id.includes("node_modules") || id.startsWith("\0")) continue;
        let directory = path.dirname(id.split("?")[0]!);
        while (directory !== path.dirname(directory)) {
          try {
            const manifest: unknown = JSON.parse(
              await readFile(path.join(directory, "package.json"), "utf8"),
            );
            if (manifest === null || typeof manifest !== "object")
              throw new Error("Invalid bundled package manifest");
            if (!("name" in manifest) || typeof manifest.name !== "string") {
              directory = path.dirname(directory);
              continue;
            }
            const version = "version" in manifest ? String(manifest.version) : "unknown";
            if (!notices.has(manifest.name)) {
              const filename = (await readdir(directory)).find((name) =>
                /^licen[sc]e(?:\.|$)/i.test(name),
              );
              if (!filename)
                throw new Error(`Bundled package ${manifest.name} has no license file`);
              notices.set(
                manifest.name,
                `${manifest.name}@${version}\n${await readFile(path.join(directory, filename), "utf8")}`,
              );
            }
            break;
          } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
              throw error;
            directory = path.dirname(directory);
          }
        }
      }
    },
  };
}
