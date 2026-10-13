import { publishedExampleSlugs } from "../examples/catalog.ts";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateExplorer } from "@dirwell/core";
import type { GenerateOptions } from "@dirwell/core";

const root = path.resolve(import.meta.dirname, "..");
const examples = publishedExampleSlugs;
process.env.DIRWELL_SITE_BASE = process.env.SITE_BASE ?? "/";
const publishedExamples = path.join(root, "docs/public/examples");
for (const example of examples) {
  const { default: options } = (await import(`../examples/${example}/config.ts`)) as {
    default: GenerateOptions;
  };
  await generateExplorer(options);
}
await mkdir(publishedExamples, { recursive: true });
await writeFile(path.join(publishedExamples, ".build-id"), randomUUID());
