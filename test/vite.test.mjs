import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { build } from "vite-upstream";
import dirwellVite from "../src/vite.ts";

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-vite-build-"));
  await mkdir(path.join(root, "files"));
  await mkdir(path.join(root, "public"));
  await writeFile(path.join(root, "files", "note.txt"), "explorer file\n");
  await writeFile(path.join(root, "public", "host.txt"), "host file\n");
  await writeFile(path.join(root, "index.html"), "<main>Host application</main>");
  return { root, close: () => rm(root, { recursive: true, force: true }) };
}

async function viteBuild(root, options, emptyOutDir = true) {
  return build({
    root,
    configFile: false,
    base: "/app/",
    logLevel: "silent",
    plugins: [dirwellVite(options)],
    build: { outDir: "dist", emptyOutDir },
  });
}

test("Vite builds SSG and MPA into a dedicated output subdirectory", async () => {
  for (const mode of ["ssg", "mpa"]) {
    const { root, close } = await fixture();
    try {
      await viteBuild(root, { root: "files", mode });
      const explorer = path.join(root, "dist", "dirwell");
      const html = await readFile(path.join(explorer, "index.html"), "utf8");
      assert.match(html, /note\.txt/);
      assert.match(html, /\/app\/dirwell\//);
      assert.equal(await readFile(path.join(explorer, "note.txt"), "utf8"), "explorer file\n");
      assert.equal(await readFile(path.join(root, "dist", "host.txt"), "utf8"), "host file\n");
      assert.match(
        await readFile(path.join(root, "dist", "index.html"), "utf8"),
        /Host application/,
      );
    } finally {
      await close();
    }
  }
});

test("relative outDir resolves from the Vite root and absolute outDir stays independent", async () => {
  const { root, close } = await fixture();
  try {
    await viteBuild(root, { root: "files", outDir: "dist/catalog" });
    assert.match(
      await readFile(path.join(root, "dist", "catalog", "index.html"), "utf8"),
      /\/app\/catalog\//,
    );
    const external = path.join(root, "published-elsewhere");
    await viteBuild(root, { root: "files", outDir: external, base: "/external/" });
    assert.match(await readFile(path.join(external, "index.html"), "utf8"), /\/external\//);
    assert.equal(await readFile(path.join(root, "dist", "host.txt"), "utf8"), "host file\n");
  } finally {
    await close();
  }
});

test("a repeated build replaces only its owned destination", async () => {
  const { root, close } = await fixture();
  try {
    await viteBuild(root, { root: "files", outDir: "dist/catalog" });
    await writeFile(path.join(root, "files", "second.txt"), "second\n");
    await viteBuild(root, { root: "files", outDir: "dist/catalog" }, false);
    assert.match(
      await readFile(path.join(root, "dist", "catalog", "index.html"), "utf8"),
      /second\.txt/,
    );
    assert.equal(await readFile(path.join(root, "dist", "host.txt"), "utf8"), "host file\n");
  } finally {
    await close();
  }
});

test("Vite refuses mirrored symlinks that would expose files outside Dirwell output", async () => {
  const { root, close } = await fixture();
  try {
    const secret = path.join(root, "secret.txt");
    const link = path.join(root, "files", "outside-link");
    await writeFile(secret, "private data\n");
    await symlink(secret, link);
    await assert.rejects(viteBuild(root, { root: "files" }), /cannot mirror a symlink outside/);
    await rm(link);
    await symlink("../secret.txt", link);
    await assert.rejects(viteBuild(root, { root: "files" }), /cannot mirror a symlink outside/);
    await viteBuild(root, { root: "files", mirror: false });
    await assert.rejects(lstat(path.join(root, "dist", "dirwell", "outside-link")), /ENOENT/);
    await rm(link);
    await symlink("note.txt", link);
    await viteBuild(root, { root: "files" });
    assert.equal(
      await readFile(path.join(root, "dist", "dirwell", "outside-link"), "utf8"),
      "explorer file\n",
    );
  } finally {
    await close();
  }
});

test("Vite options filter generated output and ignore excluded unsafe symlinks", async () => {
  for (const mode of ["ssg", "mpa"]) {
    const { root, close } = await fixture();
    try {
      await mkdir(path.join(root, "files", "private"));
      await writeFile(path.join(root, "files", "guide.md"), "public guide\n");
      await writeFile(path.join(root, "files", "private", "secret.md"), "secret\n");
      await writeFile(path.join(root, "secret.txt"), "outside\n");
      await symlink(path.join(root, "secret.txt"), path.join(root, "files", "outside-link"));
      await viteBuild(root, {
        root: "files",
        mode,
        include: ["**/*.md", "outside-link"],
        exclude: ["private/**", "outside-link"],
      });
      const output = path.join(root, "dist", "dirwell");
      assert.match(await readFile(path.join(output, "index.html"), "utf8"), /guide\.md/);
      assert.equal(await readFile(path.join(output, "guide.md"), "utf8"), "public guide\n");
      await assert.rejects(lstat(path.join(output, "note.txt")), /ENOENT/);
      await assert.rejects(lstat(path.join(output, "private")), /ENOENT/);
      await assert.rejects(lstat(path.join(output, "outside-link")), /ENOENT/);
    } finally {
      await close();
    }
  }
});

test("Vite output root and unowned destinations are never replaced", async () => {
  const { root, close } = await fixture();
  try {
    await assert.rejects(viteBuild(root, { root: "files", outDir: "dist" }), /must not contain/);
    await assert.rejects(
      viteBuild(root, { root: "files", outDir: root, base: "/" }),
      /must not contain/,
    );
    const destination = path.join(root, "dist", "catalog");
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "user.txt"), "keep me\n");
    await assert.rejects(
      viteBuild(root, { root: "files", outDir: "dist/catalog" }, false),
      /unowned outDir/,
    );
    assert.equal(await readFile(path.join(destination, "user.txt"), "utf8"), "keep me\n");
    await assert.rejects(
      viteBuild(root, { root: "files", outDir: "elsewhere" }),
      /base is required/,
    );
    await assert.rejects(
      viteBuild(root, { root: "files", outDir: "dist/catalog", base: "/app/" }),
      /dedicated path/,
    );
    await mkdir(path.join(root, "sources", "tree"), { recursive: true });
    await assert.rejects(
      viteBuild(root, { root: "sources/tree", outDir: "sources", base: "/sources/" }),
      /must not contain the source directory/,
    );
  } finally {
    await close();
  }
});

test("inline options override a project dirwell.config.ts", async () => {
  const { root, close } = await fixture();
  try {
    await writeFile(
      path.join(root, "dirwell.config.ts"),
      'export default { root: "missing", mode: "ssg", include: "**/*.md" };\n',
    );
    await viteBuild(root, { root: "files", mode: "mpa", include: "**/*.txt" });
    assert.match(
      await readFile(path.join(root, "dist", "dirwell", "index.html"), "utf8"),
      /note\.txt/,
    );
    assert.match(
      await readFile(path.join(root, "dist", "dirwell", "index.html"), "utf8"),
      /src="\/app\/dirwell\/__dirwell\/dirwell\.runtime\.js"/,
    );
  } finally {
    await close();
  }
});
