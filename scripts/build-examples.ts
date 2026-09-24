import { randomUUID } from "node:crypto";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite-upstream";
import { loadDirwellConfig } from "../src/config.ts";
import dirwellVite, { type DirwellViteOptions } from "../src/vite.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examples = [
  "basic",
  "base",
  "custom-theme",
  "default-theme-override",
  "file-icons",
  "plain",
] as const;
const siteBase = process.env.SITE_BASE ?? "/";
process.env.DIRWELL_SITE_BASE = siteBase;
const publishedExamples = path.join(root, "docs/public/examples");

const options: DirwellViteOptions[] = [];
for (const example of examples) {
  const exampleRoot = path.join(root, "examples", example);
  const { config } = await loadDirwellConfig(exampleRoot, "build");
  options.push({
    ...config,
    root: path.resolve(exampleRoot, config.root ?? "."),
    outDir: path.resolve(exampleRoot, config.outDir ?? "dist"),
    base: config.base ?? `${siteBase.replace(/\/$/, "")}/examples/${example}/`,
    urls: config.urls ?? "relative",
  });
}

// The former CLI build wrote these generated directories without Vite ownership
// markers. Convert only a tree that was completed by that build script.
const legacyBuild = await access(path.join(publishedExamples, ".build-id"))
  .then(() => true)
  .catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
const unpluginBuild = await access(path.join(publishedExamples, ".unplugin-build"))
  .then(() => true)
  .catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
if (legacyBuild && !unpluginBuild) {
  for (const option of options) {
    const outputDir = option.outDir!;
    const owned = await access(path.join(outputDir, ".dirwell-vite-output"))
      .then(() => true)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return false;
        throw error;
      });
    if (!owned) await rm(outputDir, { recursive: true, force: true });
  }
}

const viteRoot = await mkdtemp(path.join(tmpdir(), "dirwell-examples-vite-"));
try {
  await writeFile(
    path.join(viteRoot, "index.html"),
    "<!doctype html><title>Dirwell examples</title>\n",
  );
  const viteConfig = {
    root: viteRoot,
    configFile: false,
    publicDir: false,
    base: siteBase,
    logLevel: "warn",
    plugins: dirwellVite(options),
    build: { outDir: path.join(viteRoot, "dist"), emptyOutDir: true },
  };
  await build(viteConfig as Parameters<typeof build>[0]);
  await writeFile(path.join(publishedExamples, ".unplugin-build"), "dirwell-unplugin-v1\n");
  await writeFile(path.join(publishedExamples, ".build-id"), randomUUID());
} finally {
  await rm(viteRoot, { recursive: true, force: true });
}
