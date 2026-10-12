import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { runCli } from "../packages/cli/dist/index.mjs";
const theme =
  fileURLToPath(new URL("../packages/theme-plain/dist/index.mjs", import.meta.url)) +
  "#createPlainTheme";

test("separate CLI requires a theme, builds dedicated static output and owns a live server", async (context) => {
  const cwd = await mkdtemp(path.join(tmpdir(), "dirwell-cli-"));
  context.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(path.join(cwd, "source"));
  await writeFile(path.join(cwd, "source", "one.txt"), "one");
  const messages = [];
  const log = (value) => messages.push(value);
  await runCli(["--help"], cwd, log);
  assert.match(messages[0], /build/);
  assert.match(messages[0], /server/);
  await assert.rejects(runCli(["build", "source", "--out", "out"], cwd, log), /explicit/);
  await assert.rejects(runCli(["build", "source", "--theme", theme], cwd, log), /requires --out/);
  await runCli(["build", "source", "--theme", theme, "--out", "out", "--page-size", "1"], cwd, log);
  assert.match(await readFile(path.join(cwd, "out", "index.html"), "utf8"), /one.txt/);
  const server = await runCli(
    ["server", "source", "--theme", theme, "--mount", "/downloads", "--live"],
    cwd,
    log,
  );
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
