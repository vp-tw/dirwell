import { mkdtemp, mkdir, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { generateExplorer } from "../src/generator.ts";

type BenchmarkCase = "flat" | "deep";

async function writeFiles(directory: string, count: number, longNames: boolean): Promise<void> {
  for (let start = 0; start < count; start += 100) {
    await Promise.all(
      Array.from({ length: Math.min(100, count - start) }, async (_, offset) => {
        const number = String(start + offset).padStart(5, "0");
        const name = longNames
          ? `release-${number}-${"wrapped-name-".repeat(7)}.txt`
          : `file-${number}.txt`;
        await writeFile(path.join(directory, name), "x\n");
      }),
    );
  }
}

async function outputSize(directory: string): Promise<{ bytes: number; files: number }> {
  let bytes = 0;
  let files = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const child = await outputSize(entryPath);
      bytes += child.bytes;
      files += child.files;
    } else if (entry.isFile()) {
      bytes += (await stat(entryPath)).size;
      files += 1;
    }
  }
  return { bytes, files };
}

async function main(benchmarkCase: BenchmarkCase): Promise<void> {
  const temporary = await mkdtemp(path.join(tmpdir(), "dirwell-benchmark-"));
  const sourceDir = path.join(temporary, "source");
  const outputDir = path.join(temporary, "output");
  await mkdir(sourceDir);
  try {
    if (benchmarkCase === "flat") {
      await writeFiles(sourceDir, 10_000, true);
    } else {
      let current = sourceDir;
      for (let depth = 0; depth < 20; depth += 1) {
        await writeFiles(current, 100, depth % 2 === 0);
        current = path.join(current, `level-${String(depth).padStart(2, "0")}`);
        await mkdir(current);
      }
      await symlink("file-00000.txt", path.join(sourceDir, "valid-link"));
      await symlink("missing.txt", path.join(sourceDir, "broken-link"));
      await symlink(tmpdir(), path.join(sourceDir, "outside-link"));
      await symlink(".", path.join(sourceDir, "cycle-link"));
    }

    let peakRss = process.memoryUsage().rss;
    const sample = setInterval(() => {
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    }, 20);
    const start = performance.now();
    try {
      await generateExplorer({
        sourceDir,
        outputDir,
        mode: "mpa",
        symlinks: { follow: true, boundary: "root", onCycle: "skip" },
      });
    } finally {
      clearInterval(sample);
    }
    const durationMs = performance.now() - start;
    const output = await outputSize(outputDir);
    console.log(
      JSON.stringify({
        case: benchmarkCase,
        durationMs: Math.round(durationMs),
        output,
        peakRssMb: Math.round(Math.max(peakRss, process.memoryUsage().rss) / 1024 / 1024),
        runtime: process.version,
        ...(process.argv.includes("--keep") ? { directory: temporary } : {}),
      }),
    );
  } finally {
    if (!process.argv.includes("--keep")) {
      await rm(temporary, { recursive: true, force: true });
    }
  }
}

const benchmarkCase = process.argv[2];
if (benchmarkCase !== "flat" && benchmarkCase !== "deep") {
  throw new Error("Usage: node scripts/benchmark-extreme.ts <flat|deep>");
}
await main(benchmarkCase);
