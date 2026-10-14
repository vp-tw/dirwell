import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { workspacePackages } from "./workspace-packages.mjs";
import { readProvenance, releaseTag } from "./alpha-release.mjs";

export const repository = "vp-tw/dirwell";
export const workflow = "publish-workspace.yml";
export const artifactDirectory = process.env.DIRWELL_RELEASE_DIR ?? ".workspace-release";
const integrity = (bytes) => "sha512-" + createHash("sha512").update(bytes).digest("base64");

export function validatePublicationAuthentication(environment, version) {
  assert.equal(
    environment.GITHUB_ACTIONS,
    "true",
    "Publishing requires the qualified GitHub workflow",
  );
  assert.ok(environment.ACTIONS_ID_TOKEN_REQUEST_URL, "Missing provenance OIDC environment");
  const authentication = environment.DIRWELL_PUBLISH_AUTH ?? "oidc";
  assert.ok(
    ["oidc", "bootstrap-token"].includes(authentication),
    "Unknown publication authentication",
  );
  if (authentication === "bootstrap-token") {
    assert.equal(version, "0.0.1-alpha", "Bootstrap credentials are limited to the first alpha");
    assert.ok(environment.NODE_AUTH_TOKEN, "Missing NPM_BOOTSTRAP_TOKEN secret");
  } else {
    assert.ok(!environment.NODE_AUTH_TOKEN, "OIDC publication must not receive an npm token");
  }
}

export function validatePackage(metadata, version, { publish = false } = {}) {
  assert.match(
    version,
    /^0\.0\.(?:0|[1-9]\d*)(?:-alpha(?:\.(?:0|[1-9]\d*))?)?$/,
    "Only synchronized SDK 0.0.x stable or alpha versions are supported",
  );
  assert.ok(
    workspacePackages.includes(metadata.name?.replace("@dirwell/", "")),
    "Unexpected package",
  );
  assert.equal(
    metadata.name,
    "@dirwell/" + metadata.repository?.directory?.replace("packages/", ""),
  );
  assert.equal(metadata.version, version, "Mixed package versions");
  assert.equal(metadata.repository?.url, `git+https://github.com/${repository}.git`);
  assert.equal(metadata.publishConfig?.access, "public");
  assert.equal(metadata.publishConfig?.tag, releaseTag(version));
  assert.equal(metadata.publishConfig?.provenance, true);
  assert.equal(metadata.engines?.node, ">=22.12.0");
  if (publish) assert.notEqual(metadata.private, true, "Private publication guard remains enabled");
  for (const [name, range] of Object.entries(metadata.dependencies ?? {})) {
    if (name.startsWith("@dirwell/")) {
      assert.ok(
        workspacePackages.includes(name.slice("@dirwell/".length)),
        "Unknown internal dependency",
      );
      assert.equal(range, version, "Packed internal dependencies must be exact and resolved");
    }
  }
}

export function validateManifest(manifest, environment, { publish = false } = {}) {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.repository, repository);
  assert.equal(manifest.workflow, workflow);
  assert.match(manifest.commit, /^[a-f0-9]{40}$/);
  assert.equal(environment.RELEASE_VERSION, manifest.version);
  if (publish || environment.GITHUB_ACTIONS === "true") {
    assert.equal(environment.GITHUB_REPOSITORY, repository);
    assert.equal(environment.GITHUB_REF, "refs/heads/main");
    assert.equal(environment.GITHUB_EVENT_NAME, "workflow_dispatch");
    assert.equal(environment.GITHUB_SHA, manifest.commit);
  }
  assert.deepEqual(
    manifest.packages.map((item) => item.metadata.name),
    workspacePackages.map((name) => "@dirwell/" + name),
  );
  const visited = new Set();
  for (const item of manifest.packages) {
    validatePackage(item.metadata, manifest.version, { publish });
    assert.equal(item.filename, `dirwell-${item.metadata.name.slice(9)}-${manifest.version}.tgz`);
    assert.match(item.integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
    for (const name of Object.keys(item.metadata.dependencies ?? {}))
      if (name.startsWith("@dirwell/")) assert.ok(visited.has(name), "Dependency order violated");
    visited.add(item.metadata.name);
  }
}

/** Preflight every package before the first mutation. Existing versions are immutable. */
export async function publicationPlan(manifest, lookup) {
  const plan = [];
  for (const item of manifest.packages) {
    const current = await lookup(item.metadata.name, manifest.version);
    if (current !== null) {
      assert.equal(current.name, item.metadata.name);
      assert.equal(current.version, manifest.version);
      assert.equal(
        current.dist?.integrity,
        item.integrity,
        "Registry bytes differ: use a new version",
      );
    }
    plan.push({ item, action: current === null ? "publish" : "skip" });
  }
  return plan;
}

export function validateWorkspaceProvenance(statement, manifest, item) {
  assert.equal(statement.predicateType, "https://slsa.dev/provenance/v1");
  const definition = statement.predicate.buildDefinition;
  assert.deepEqual(definition.externalParameters.workflow, {
    ref: "refs/heads/main",
    repository: `https://github.com/${repository}`,
    path: `.github/workflows/${workflow}`,
  });
  assert.ok(
    definition.resolvedDependencies.some(
      (value) =>
        value.digest?.gitCommit === manifest.commit &&
        value.uri === `git+https://github.com/${repository}@refs/heads/main`,
    ),
  );
  const digest = Buffer.from(item.integrity.slice(7), "base64").toString("hex");
  assert.ok(statement.subject.some((value) => value.digest?.sha512 === digest));
}

export async function verifyArtifact(directory, manifest) {
  for (const item of manifest.packages) {
    const filename = path.join(directory, item.filename);
    assert.equal(
      integrity(await readFile(filename)),
      item.integrity,
      "Tarball changed after verification",
    );
    const metadata = JSON.parse(
      execFileSync("tar", ["-xOf", filename, "package/package.json"], { encoding: "utf8" }),
    );
    assert.deepEqual(metadata, item.metadata, "Manifest does not match packed metadata");
  }
}

async function lookup(name, version) {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`);
  if (response.status === 404) return null;
  assert.ok(response.ok, `Registry lookup failed: ${response.status}`);
  return response.json();
}

export async function readback(manifest, directory = artifactDirectory) {
  const proofs = [];
  for (const item of manifest.packages) {
    let result;
    for (let attempt = 0; attempt < 20; attempt++) {
      const metadata = await lookup(item.metadata.name, manifest.version);
      if (metadata?.dist?.integrity === item.integrity && metadata.dist.attestations?.url) {
        const statement = await readProvenance(metadata.dist.attestations.url);
        if (statement) {
          validateWorkspaceProvenance(statement, manifest, item);
          const payload = await fetch(metadata.dist.tarball);
          assert.ok(payload.ok, "Registry tarball download failed");
          const bytes = new Uint8Array(await payload.arrayBuffer());
          assert.equal(integrity(bytes), item.integrity);
          const tags = await fetch(
            `https://registry.npmjs.org/${encodeURIComponent(item.metadata.name)}`,
          );
          // Exact-version metadata can propagate before the packument and its release-channel tag.
          if (
            tags.ok &&
            (await tags.json())["dist-tags"]?.[releaseTag(manifest.version)] === manifest.version
          ) {
            result = {
              name: item.metadata.name,
              version: manifest.version,
              integrity: item.integrity,
              provenance: true,
            };
            break;
          }
          if (!tags.ok && tags.status !== 404 && tags.status !== 429 && tags.status < 500)
            throw new Error(`Registry tag lookup failed: ${tags.status}`);
        }
      }
      if (metadata && metadata.dist?.integrity !== item.integrity)
        throw new Error("Registry bytes differ");
      await new Promise((resolve) => setTimeout(resolve, 30000));
    }
    assert.ok(result, `Registry/provenance readback incomplete: ${item.metadata.name}`);
    proofs.push(result);
    await writeFile(
      path.join(directory, "registry-proof.json"),
      JSON.stringify({ commit: manifest.commit, proofs }, null, 2) + "\n",
    );
  }
}

async function main(mode) {
  assert.ok(
    ["prepare", "verify", "plan", "publish", "readback"].includes(mode),
    "Unknown release action",
  );
  if (mode === "prepare") {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    assert.equal(
      execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
        encoding: "utf8",
      }).trim(),
      "",
      "Commit release inputs first",
    );
    let existing;
    try {
      existing = JSON.parse(await readFile(path.join(artifactDirectory, "manifest.json"), "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (existing !== undefined) {
      validateManifest(existing, process.env);
      assert.equal(
        existing.commit,
        commit,
        "Existing artifact belongs to another source; choose a new DIRWELL_RELEASE_DIR",
      );
      await verifyArtifact(artifactDirectory, existing);
      console.log("Reused verified immutable workspace artifacts");
      return;
    }
    await mkdir(artifactDirectory, { recursive: true });
    execFileSync("node", ["scripts/pack-workspace.mjs", artifactDirectory], { stdio: "inherit" });
    const packages = [];
    for (const name of workspacePackages) {
      const source = JSON.parse(await readFile(`packages/${name}/package.json`, "utf8"));
      const filename = `dirwell-${name}-${source.version}.tgz`;
      const metadata = JSON.parse(
        execFileSync(
          "tar",
          ["-xOf", path.join(artifactDirectory, filename), "package/package.json"],
          { encoding: "utf8" },
        ),
      );
      packages.push({
        filename,
        metadata,
        integrity: integrity(await readFile(path.join(artifactDirectory, filename))),
      });
    }
    const manifest = {
      schemaVersion: 1,
      repository,
      workflow,
      commit,
      version: process.env.RELEASE_VERSION,
      packages,
    };
    validateManifest(manifest, process.env);
    await verifyArtifact(artifactDirectory, manifest);
    await writeFile(
      path.join(artifactDirectory, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    return;
  }
  const manifest = JSON.parse(
    await readFile(path.join(artifactDirectory, "manifest.json"), "utf8"),
  );
  validateManifest(manifest, process.env, { publish: mode === "publish" });
  assert.equal(
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    manifest.commit,
  );
  await verifyArtifact(artifactDirectory, manifest);
  if (mode === "verify") {
    console.log("Verified immutable workspace tarballs");
    return;
  }
  if (mode === "readback") {
    await readback(manifest);
    return;
  }
  if (mode === "publish") validatePublicationAuthentication(process.env, manifest.version);
  const plan = await publicationPlan(manifest, lookup);
  console.log(
    JSON.stringify(
      plan.map(({ item, action }) => ({ name: item.metadata.name, action })),
      null,
      2,
    ),
  );
  if (mode === "plan") return;
  // A partial release reruns against the same artifact. Never repack during publication.
  for (const { item, action } of plan) {
    if (action === "skip") continue;
    execFileSync(
      "npm",
      [
        "publish",
        path.join(artifactDirectory, item.filename),
        "--access",
        "public",
        "--tag",
        releaseTag(manifest.version),
        "--provenance",
        "--ignore-scripts",
        "--registry",
        "https://registry.npmjs.org",
      ],
      { stdio: "inherit" },
    );
  }
  await readback(manifest);
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
  await main(process.argv[2]);
