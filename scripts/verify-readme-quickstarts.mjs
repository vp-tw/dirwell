import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const artifacts = path.resolve(process.argv[2]);
const metadata = JSON.parse(await readFile(path.join(artifacts, "packages.json"), "utf8"));
const tarballs = Object.fromEntries(
  metadata.map((pkg) => [pkg.name, "file:" + path.join(artifacts, pkg.filename)]),
);
const repository = path.resolve(import.meta.dirname, "..");
const root = await mkdtemp(path.join(tmpdir(), "dirwell-readme-"));
const proof = [];
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32" && command.endsWith(".cmd"),
  });
  if (result.status !== 0) throw new Error(result.stdout + "\n" + result.stderr);
  return result.stdout;
}
async function blocks(name, language = "js") {
  const markdown = await readFile(path.join(repository, "packages", name, "README.md"), "utf8");
  return [...markdown.matchAll(new RegExp("```" + language + "\\n([\\s\\S]*?)\\n```", "g"))].map(
    (match) => match[1],
  );
}
async function trial(name, packages, dev = {}) {
  const cwd = path.join(root, name);
  await mkdir(path.join(cwd, "files"), { recursive: true });
  await writeFile(path.join(cwd, "files/note.txt"), "Quick start fixture");
  // Resolve unpublished sibling artifacts at their actual candidate versions.
  // Overrides do not install packages: each scenario has only its documented root dependencies.
  await writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: Object.fromEntries(packages.map((pkg) => [pkg, tarballs[pkg]])),
        devDependencies: dev,
        overrides: tarballs,
      },
      null,
      2,
    ),
  );
  run(npm, ["install", "--ignore-scripts", "--no-audit", "--no-fund"], cwd);
  return cwd;
}
async function record(name, cwd) {
  const lock = JSON.parse(await readFile(path.join(cwd, "package-lock.json"), "utf8"));
  const installed = Object.keys(lock.packages)
    .filter((name) => name.startsWith("node_modules/@dirwell/"))
    .sort();
  proof.push({ name, installed });
  process.stderr.write(`${name}: quick start passed (${installed.length} family packages)\n`);
}
async function live(cwd, script, cli = false) {
  const child = spawn(
    process.execPath,
    cli ? [script, "server", "files", "--port", "0"] : [script],
    { cwd, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "",
    errors = "",
    timer;
  const exited = new Promise((resolve) =>
    child.once("exit", (code, signal) => resolve({ code, signal })),
  );
  child.stderr.on("data", (chunk) => {
    errors += chunk;
  });
  try {
    const url = await new Promise((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Server did not become ready: " + errors)), 15000);
      child.stdout.on("data", (chunk) => {
        output += chunk;
        const match = output.match(/http:\/\/[^\s]+/);
        if (match) resolve(match[0]);
      });
      child.once("exit", () => reject(new Error("Server exited before readiness: " + errors)));
    });
    clearTimeout(timer);
    const response = await fetch(url.includes("/browse") ? url : new URL("/browse/", url));
    assert.equal(response.status, 200);
    assert.match(await response.text(), /note\.txt/);
    child.kill("SIGINT");
    const ended = await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (!ended) throw new Error("Server did not close after SIGINT");
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await exited;
  }
}
try {
  for (const name of ["core", "theme-plain", "theme-ledger", "theme-crosswave"]) {
    const theme = name === "core" ? "theme-plain" : name;
    const cwd = await trial(name, ["@dirwell/core", "@dirwell/" + theme]);
    await writeFile(path.join(cwd, "build.mjs"), (await blocks(name))[0]);
    run(process.execPath, ["build.mjs"], cwd);
    assert.match(await readFile(path.join(cwd, "generated/index.html"), "utf8"), /note\.txt/);
    if (name.startsWith("theme-")) {
      const factory = {
        "theme-plain": "createPlainTheme",
        "theme-ledger": "createLedgerTheme",
        "theme-crosswave": "createCrosswaveTheme",
      }[name];
      const png = await readFile(path.join(repository, "docs/public/brand/favicon-32.png"));
      await writeFile(path.join(cwd, "favicon.png"), png);
      const example = (await blocks(name))[1];
      await writeFile(
        path.join(cwd, "favicon.mjs"),
        `import { generateExplorer } from "@dirwell/core";\nimport { ${factory} } from "@dirwell/${name}";\nconst theme = ${example}\nawait generateExplorer({ sourceDir: "files", outputDir: "favicon-output", theme });`,
      );
      run(process.execPath, ["favicon.mjs"], cwd);
      const html = await readFile(path.join(cwd, "favicon-output/index.html"), "utf8");
      const href = html.match(/<link rel="icon" href="([^"]+)"/)[1];
      assert.deepEqual(await readFile(path.join(cwd, "favicon-output", href)), png);
    }
    await record(name, cwd);
  }
  const cli = await trial("cli", ["@dirwell/cli"]);
  const cliBin = path.join(cli, "node_modules/@dirwell/cli/dist/bin.mjs");
  run(process.execPath, [cliBin, "build", "files", "--out", "generated"], cli);
  await live(cli, cliBin, true);
  assert.match(await readFile(path.join(cli, "generated/index.html"), "utf8"), /note\.txt/);
  await record("cli", cli);
  const server = await trial("server", ["@dirwell/server", "@dirwell/theme-plain"]);
  await writeFile(path.join(server, "server.mjs"), (await blocks("server"))[0]);
  await live(server, "server.mjs");
  await record("server", server);
  const images = await trial("share-image", ["@dirwell/share-image"]);
  await writeFile(path.join(images, "image.mjs"), (await blocks("share-image"))[0]);
  run(process.execPath, ["image.mjs"], images);
  const png = await readFile(path.join(images, "share.png"));
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  await record("share-image", images);
  const host = await trial("integrations", ["@dirwell/integrations", "@dirwell/theme-plain"], {
    vite: "8.3.0",
  });
  await writeFile(path.join(host, "index.html"), "<!doctype html><title>Host application</title>");
  await writeFile(path.join(host, "vite.config.mjs"), (await blocks("integrations"))[0]);
  run(process.execPath, [path.join(host, "node_modules/vite/bin/vite.js"), "build"], host);
  assert.match(await readFile(path.join(host, "dist/downloads/index.html"), "utf8"), /note\.txt/);
  await record("integrations", host);
  const author = await trial("theme-authoring", [
    "@dirwell/theme-authoring",
    "@dirwell/theme-crosswave",
    "@dirwell/core",
  ]);
  await writeFile(path.join(author, "Downloads.vue"), (await blocks("theme-authoring", "vue"))[0]);
  await writeFile(path.join(author, "build.mjs"), (await blocks("theme-authoring"))[0]);
  run(process.execPath, ["build.mjs"], author);
  assert.match(
    await readFile(path.join(author, "generated/index.html"), "utf8"),
    /Project downloads/,
  );
  await record("theme-authoring", author);
  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        proof,
        limits: [
          "Local candidate tarballs; sibling artifact overrides only resolve unpublished versions and do not add root dependencies.",
          "Public registry installation and npm-page rendering require post-publication proof.",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
