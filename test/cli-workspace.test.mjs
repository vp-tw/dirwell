import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { runCli } from "../packages/cli/dist/index.mjs";
const theme =
  fileURLToPath(new URL("../packages/theme-plain/dist/index.mjs", import.meta.url)) +
  "#createPlainTheme";

test("separate CLI defaults to Plain, builds dedicated static output and owns a live server", async (context) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "dirwell-cli-"));
  context.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(path.join(cwd, "source"));
  await writeFile(path.join(cwd, "source", "one.txt"), "one");
  const messages = [];
  const log = (value) => messages.push(value);
  await runCli(["--help"], cwd, log);
  assert.match(messages[0], /build/);
  assert.match(messages[0], /server/);
  for (const option of ["--live", "--port", "--host", "--mount"])
    await assert.rejects(
      runCli(["build", "source", option, ...(option === "--live" ? [] : ["invalid"])], cwd, log),
      /not supported in build mode/,
    );
  for (const option of ["--out", "--mode", "--urls", "--base"])
    await assert.rejects(
      runCli(["server", "source", option, "invalid"], cwd, log),
      /not supported in server mode/,
    );
  await runCli(["build", "source", "--out", "default-out"], cwd, log);
  const defaultHtml = await readFile(path.join(cwd, "default-out", "index.html"), "utf8");
  assert.match(defaultHtml, /one.txt/);
  assert.doesNotMatch(defaultHtml, /<script|og:image/);
  await assert.rejects(runCli(["build", "source", "--theme", theme], cwd, log), /requires --out/);
  await runCli(["build", "source", "--theme", theme, "--out", "out", "--page-size", "1"], cwd, log);
  assert.match(await readFile(path.join(cwd, "out", "index.html"), "utf8"), /one.txt/);
  const server = await runCli(["server", "source", "--mount", "/downloads", "--live"], cwd, log);
  try {
    const response = await fetch(server.url + "/downloads/browse/");
    assert.equal(response.status, 200);
    assert.match(await response.text(), /one.txt/);
    await writeFile(path.join(cwd, "source", "new.txt"), "new");
    assert.match(await (await fetch(server.url + "/downloads/browse/")).text(), /new.txt/);
  } finally {
    await server.close();
  }
});

test("config theme overrides Plain and an explicit theme overrides config", async (context) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "dirwell-cli-config-"));
  context.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(path.join(cwd, "source"));
  await writeFile(path.join(cwd, "source", "one.txt"), "one");
  await writeFile(
    path.join(cwd, "dirwell.config.mjs"),
    'export default {theme:{name:"custom",render:()=>({html:"<!doctype html><title>Custom proof</title>"})}};',
  );
  await runCli(["build", "source", "--out", "custom-out"], cwd, () => {});
  assert.match(await readFile(path.join(cwd, "custom-out", "index.html"), "utf8"), /Custom proof/);
  await writeFile(path.join(cwd, "other.mjs"), "export default {};");
  await runCli(
    ["build", "source", "--out", "explicit-config-out", "--config", "other.mjs"],
    cwd,
    () => {},
  );
  assert.match(
    await readFile(path.join(cwd, "explicit-config-out", "index.html"), "utf8"),
    /one.txt/,
  );
  await assert.rejects(
    runCli(
      ["build", "source", "--out", "missing-config-out", "--config", "missing.mjs"],
      cwd,
      () => {},
    ),
    /Cannot find module/,
  );
  await writeFile(path.join(cwd, "invalid-port.mjs"), "export default {server:{port:-1}};");
  await assert.rejects(
    runCli(["server", "source", "--config", "invalid-port.mjs"], cwd, () => {}),
    /port must be between/,
  );
  const overriddenPort = await runCli(
    ["server", "source", "--config", "invalid-port.mjs", "--port", "0"],
    cwd,
    () => {},
  );
  await overriddenPort.close();
  await writeFile(
    path.join(cwd, "invalid-live.mjs"),
    "export default {server:{live:{intervalMs:1}}};",
  );
  await assert.rejects(
    runCli(["server", "source", "--config", "invalid-live.mjs", "--live"], cwd, () => {}),
    /Invalid live update limits/,
  );
  await writeFile(path.join(cwd, "invalid-theme.mjs"), "export default {theme:null};");
  await assert.rejects(
    runCli(["build", "source", "--out", "out", "--config", "invalid-theme.mjs"], cwd, () => {}),
    /Theme must be an object/,
  );
  await assert.rejects(
    runCli(["build", "source", "--out", "out", "--theme", ""], cwd, () => {}),
    /Theme needs a module/,
  );
  await runCli(["build", "source", "--out", "override-out", "--theme", theme], cwd, () => {});
  assert.match(await readFile(path.join(cwd, "override-out", "index.html"), "utf8"), /one.txt/);
  const server = await runCli(["server", "source"], cwd, () => {});
  try {
    assert.match(await (await fetch(server.url + "/browse/")).text(), /Custom proof/);
  } finally {
    await server.close();
  }
});

test("explicit short theme names resolve from the project and missing packages explain installation", async (context) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "dirwell-cli-theme-"));
  context.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(path.join(cwd, "source"));
  await writeFile(path.join(cwd, "source", "one.txt"), "one");
  await assert.rejects(
    runCli(
      ["build", "source", "--out", "out", "--theme", "dirwell-missing-theme-proof"],
      cwd,
      () => {},
    ),
    /Install it in your project or include it with npm exec/,
  );
  await mkdir(path.join(cwd, "node_modules", "@dirwell"), { recursive: true });
  await symlink(
    fileURLToPath(new URL("../packages/theme-plain", import.meta.url)),
    path.join(cwd, "node_modules", "@dirwell", "theme-plain"),
    "junction",
  );
  await runCli(["build", "source", "--out", "out", "--theme", "plain"], cwd, () => {});
  const html = await readFile(path.join(cwd, "out", "index.html"), "utf8");
  assert.match(html, /one.txt/);
  assert.doesNotMatch(html, /<script|og:image/);
});

test("legacy configuration cannot silently lose its selection rules", async (context) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "dirwell-cli-migration-"));
  context.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(path.join(cwd, "source"));
  await writeFile(path.join(cwd, "source", "private.txt"), "private");
  await writeFile(path.join(cwd, "dirwell.config.ts"), 'export default {exclude:["private.txt"]};');
  await assert.rejects(
    runCli(["build", "source", "--out", "out"], cwd, () => {}),
    /existing rules will not be silently ignored/,
  );
  await writeFile(
    path.join(cwd, "dirwell.config.mjs"),
    'export default {build:{exclude:["private.txt"]}};',
  );
  await runCli(["build", "source", "--out", "out"], cwd, () => {});
  assert.doesNotMatch(await readFile(path.join(cwd, "out", "index.html"), "utf8"), /private.txt/);
});
