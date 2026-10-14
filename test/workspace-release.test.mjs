import assert from "node:assert/strict";
import test from "node:test";
import { workspacePackages } from "../scripts/workspace-packages.mjs";
import {
  validateManifest,
  publicationPlan,
  validateWorkspaceProvenance,
  validatePublicationAuthentication,
} from "../scripts/workspace-release.mjs";
const version = "0.0.1-alpha";
const environment = {
  RELEASE_VERSION: version,
  GITHUB_REPOSITORY: "vp-tw/dirwell",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_SHA: "a".repeat(40),
};
test("bootstrap authentication is explicit, first-alpha-only and still requires provenance", () => {
  const oidc = {
    GITHUB_ACTIONS: "true",
    ACTIONS_ID_TOKEN_REQUEST_URL: "https://example.invalid/oidc",
  };
  validatePublicationAuthentication(oidc, version);
  const bootstrap = {
    ...oidc,
    DIRWELL_PUBLISH_AUTH: "bootstrap-token",
    NODE_AUTH_TOKEN: "test-only",
  };
  validatePublicationAuthentication(bootstrap, version);
  assert.throws(
    () => validatePublicationAuthentication({ ...bootstrap, NODE_AUTH_TOKEN: "" }, version),
    /Missing NPM_BOOTSTRAP_TOKEN/,
  );
  assert.throws(() => validatePublicationAuthentication(bootstrap, "0.0.1-alpha.1"), /first alpha/);
  assert.throws(
    () =>
      validatePublicationAuthentication(
        { ...bootstrap, ACTIONS_ID_TOKEN_REQUEST_URL: "" },
        version,
      ),
    /provenance/,
  );
  assert.throws(
    () => validatePublicationAuthentication({ ...bootstrap, GITHUB_ACTIONS: "false" }, version),
    /qualified/,
  );
  assert.throws(
    () => validatePublicationAuthentication({ ...oidc, NODE_AUTH_TOKEN: "test-only" }, version),
    /must not receive/,
  );
  assert.throws(
    () => validatePublicationAuthentication({ ...oidc, DIRWELL_PUBLISH_AUTH: "unknown" }, version),
    /Unknown/,
  );
});
function fixture() {
  return {
    schemaVersion: 1,
    repository: "vp-tw/dirwell",
    workflow: "publish-workspace.yml",
    commit: environment.GITHUB_SHA,
    version,
    packages: workspacePackages.map((name) => ({
      filename: `dirwell-${name}-${version}.tgz`,
      integrity: "sha512-" + Buffer.alloc(64).toString("base64"),
      metadata: {
        name: "@dirwell/" + name,
        version,
        private: true,
        repository: {
          url: "git+https://github.com/vp-tw/dirwell.git",
          directory: "packages/" + name,
        },
        publishConfig: { access: "public", tag: "alpha", provenance: true },
        engines: { node: ">=22.12.0" },
        dependencies: name === "core" || name === "theme-plain" ? {} : { "@dirwell/core": version },
      },
    })),
  };
}
test("offline private artifacts qualify; publishing keeps its private and exact-source gates", () => {
  const manifest = fixture();
  validateManifest(manifest, environment);
  assert.throws(() => validateManifest(manifest, environment, { publish: true }), /Private/);
  for (const item of manifest.packages) item.metadata.private = false;
  validateManifest(manifest, environment, { publish: true });
  for (const [key, value] of Object.entries({
    GITHUB_REPOSITORY: "other/repo",
    GITHUB_REF: "refs/heads/topic",
    GITHUB_EVENT_NAME: "pull_request",
    GITHUB_SHA: "b".repeat(40),
    RELEASE_VERSION: "0.0.2-alpha",
  }))
    assert.throws(() =>
      validateManifest(manifest, { ...environment, [key]: value }, { publish: true }),
    );
});
test("reject unresolved dependencies, wrong order, omitted packages and unsafe filenames", () => {
  for (const mutate of [
    (m) => (m.packages[2].metadata.dependencies["@dirwell/core"] = "workspace:*"),
    (m) => m.packages.reverse(),
    (m) => m.packages.pop(),
    (m) => (m.packages[0].filename = "../outside.tgz"),
    (m) => (m.packages[0].metadata.version = "0.0.2-alpha"),
    (m) => (m.packages[0].metadata.publishConfig.provenance = false),
  ]) {
    const manifest = fixture();
    mutate(manifest);
    assert.throws(() => validateManifest(manifest, environment));
  }
});
test("partial publication skips identical versions and preflights the entire family", async () => {
  const manifest = fixture();
  const calls = [];
  const plan = await publicationPlan(manifest, async (name, version) => {
    calls.push(name);
    return calls.length <= 2
      ? { name, version, dist: { integrity: manifest.packages[0].integrity } }
      : null;
  });
  assert.equal(calls.length, workspacePackages.length);
  assert.deepEqual(
    plan.map((p) => p.action),
    ["skip", "skip", ...workspacePackages.slice(2).map(() => "publish")],
  );
  await assert.rejects(
    publicationPlan(manifest, async (name, version) =>
      name === "@dirwell/cli" ? { name, version, dist: { integrity: "different" } } : null,
    ),
    /Registry bytes differ/,
  );
});
test("provenance binds workflow, source and this package payload", () => {
  const manifest = fixture();
  const item = manifest.packages[0];
  const statement = {
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            ref: "refs/heads/main",
            repository: "https://github.com/vp-tw/dirwell",
            path: ".github/workflows/publish-workspace.yml",
          },
        },
        resolvedDependencies: [
          {
            uri: "git+https://github.com/vp-tw/dirwell@refs/heads/main",
            digest: { gitCommit: manifest.commit },
          },
        ],
      },
    },
    subject: [{ digest: { sha512: Buffer.alloc(64).toString("hex") } }],
  };
  validateWorkspaceProvenance(statement, manifest, item);
  statement.predicate.buildDefinition.externalParameters.workflow.path =
    ".github/workflows/publish-alpha.yml";
  assert.throws(() => validateWorkspaceProvenance(statement, manifest, item));
});

test("artifact verification rejects changed bytes and packed-metadata substitution", async (context) => {
  const { mkdtemp, mkdir, writeFile, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const { createHash } = await import("node:crypto");
  const { verifyArtifact } = await import("../scripts/workspace-release.mjs");
  const root = await mkdtemp(path.join(tmpdir(), "dirwell-release-artifact-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "package"));
  const metadata = fixture().packages[0].metadata;
  await writeFile(path.join(root, "package/package.json"), JSON.stringify(metadata));
  const filename = "dirwell-core-0.0.1-alpha.tgz";
  execFileSync("tar", ["-czf", path.join(root, filename), "-C", root, "package"]);
  const bytes = await readFile(path.join(root, filename));
  const manifest = {
    packages: [
      {
        filename,
        metadata,
        integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64"),
      },
    ],
  };
  await verifyArtifact(root, manifest);
  await assert.rejects(
    verifyArtifact(root, {
      packages: [{ ...manifest.packages[0], metadata: { ...metadata, version: "different" } }],
    }),
    /packed metadata/,
  );
  await writeFile(path.join(root, filename), Buffer.concat([bytes, Buffer.from("altered")]));
  await assert.rejects(verifyArtifact(root, manifest), /Tarball changed/);
});

test("registry readback waits for packument/tag propagation and keeps integrity failures fatal", async (context) => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  const { createHash } = await import("node:crypto");
  const { readback } = await import("../scripts/workspace-release.mjs");
  const output = await mkdtemp(path.join(tmpdir(), "dirwell-registry-retry-"));
  context.after(() => rm(output, { recursive: true, force: true }));
  const bytes = Buffer.from("qualified published payload");
  const digest = createHash("sha512").update(bytes).digest();
  const manifest = fixture();
  manifest.packages = [manifest.packages[0]];
  manifest.packages[0].integrity = "sha512-" + digest.toString("base64");
  const statement = {
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            ref: "refs/heads/main",
            repository: "https://github.com/vp-tw/dirwell",
            path: ".github/workflows/publish-workspace.yml",
          },
        },
        resolvedDependencies: [
          {
            uri: "git+https://github.com/vp-tw/dirwell@refs/heads/main",
            digest: { gitCommit: manifest.commit },
          },
        ],
      },
    },
    subject: [{ digest: { sha512: digest.toString("hex") } }],
  };
  let tagCalls = 0,
    damaged = false,
    unavailable = false;
  context.mock.method(globalThis, "setTimeout", (callback) => {
    queueMicrotask(callback);
    return 0;
  });
  context.mock.method(globalThis, "fetch", async (url) => {
    if (url === "https://example.invalid/tarball")
      return new Response(damaged ? "different bytes" : bytes);
    if (url === "https://example.invalid/provenance")
      return Response.json({
        attestations: [
          {
            predicateType: statement.predicateType,
            bundle: {
              dsseEnvelope: { payload: Buffer.from(JSON.stringify(statement)).toString("base64") },
            },
          },
        ],
      });
    if (url.endsWith("/" + version))
      return Response.json({
        dist: {
          integrity: manifest.packages[0].integrity,
          tarball: "https://example.invalid/tarball",
          attestations: { url: "https://example.invalid/provenance" },
        },
      });
    tagCalls++;
    return unavailable || tagCalls === 1
      ? new Response(null, { status: 404 })
      : Response.json({ "dist-tags": { alpha: tagCalls === 2 ? "0.0.0-stage" : version } });
  });
  await readback(manifest, output);
  assert.equal(tagCalls, 3);
  assert.equal(
    JSON.parse(await readFile(path.join(output, "registry-proof.json"), "utf8")).proofs.length,
    1,
  );
  damaged = true;
  await assert.rejects(readback(manifest, output));
  assert.equal(tagCalls, 3, "damaged payload must fail before tags or retry");
  damaged = false;
  unavailable = true;
  await assert.rejects(readback(manifest, output), /readback incomplete/);
  assert.equal(tagCalls, 23, "packument absence must exhaust the existing 20-attempt bound");
});

test("stable SDK artifacts require latest, exact sibling versions and OIDC", () => {
  const manifest = fixture();
  manifest.version = "0.0.1";
  for (const item of manifest.packages) {
    item.filename = item.filename.replace(version, manifest.version);
    item.metadata.version = manifest.version;
    item.metadata.publishConfig.tag = "latest";
    for (const name of Object.keys(item.metadata.dependencies))
      item.metadata.dependencies[name] = manifest.version;
  }
  validateManifest(manifest, { ...environment, RELEASE_VERSION: manifest.version });
  manifest.packages[0].metadata.publishConfig.tag = "alpha";
  assert.throws(() =>
    validateManifest(manifest, { ...environment, RELEASE_VERSION: manifest.version }),
  );
  const bootstrap = {
    GITHUB_ACTIONS: "true",
    ACTIONS_ID_TOKEN_REQUEST_URL: "test-only",
    DIRWELL_PUBLISH_AUTH: "bootstrap-token",
    NODE_AUTH_TOKEN: "test-only",
  };
  assert.throws(() => validatePublicationAuthentication(bootstrap, "0.0.1"), /first alpha/);
});
