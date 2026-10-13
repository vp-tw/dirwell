import path from "node:path";
import { generateExplorer } from "@dirwell/core";
import type { GenerateOptions } from "@dirwell/core";
import { publishedExampleSlugs } from "../examples/catalog.ts";

const [slug, output] = process.argv.slice(2);
if (!slug || !publishedExampleSlugs.some((name) => name === slug) || !output)
  throw new TypeError("Usage: node scripts/build-example.ts <example> <dedicated-output>");
const { default: options } = (await import(`../examples/${slug}/config.ts`)) as {
  default: GenerateOptions;
};
await generateExplorer({ ...options, outputDir: path.resolve(output) });
