import assert from "node:assert/strict";
import test from "node:test";
import { validateProvenance, validateRelease } from "../scripts/alpha-release.mjs";

const metadata = {
  name: "@vp-tw/dirwell",
  version: "0.1.0-alpha.1",
  publishConfig: { tag: "alpha", access: "public" },
  repository: { url: "git+https://github.com/vp-tw/dirwell.git" },
};
const environment = {
  GITHUB_REPOSITORY: "vp-tw/dirwell",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_SHA: "a".repeat(40),
  RELEASE_VERSION: metadata.version,
};

test("alpha release accepts the exact main version and rejects unsafe dispatches", () => {
  validateRelease(metadata, environment);
  for (const change of [
    { GITHUB_REF: "refs/heads/feature" },
    { GITHUB_REPOSITORY: "fork/dirwell" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_SHA: "main" },
    { RELEASE_VERSION: "0.1.0-alpha.0" },
  ])
    assert.throws(() => validateRelease(metadata, { ...environment, ...change }));
  assert.throws(() =>
    validateRelease(
      { ...metadata, version: "0.1.0" },
      { ...environment, RELEASE_VERSION: "0.1.0" },
    ),
  );
  assert.throws(() =>
    validateRelease(
      { ...metadata, publishConfig: { tag: "latest", access: "public" } },
      environment,
    ),
  );
});

test("provenance must bind the artifact to the reviewed workflow and source", () => {
  const manifest = {
    commit: environment.GITHUB_SHA,
    integrity: `sha512-${Buffer.from("artifact").toString("base64")}`,
  };
  const statement = {
    predicateType: "https://slsa.dev/provenance/v1",
    subject: [{ digest: { sha512: Buffer.from("artifact").toString("hex") } }],
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            ref: "refs/heads/main",
            repository: "https://github.com/vp-tw/dirwell",
            path: ".github/workflows/publish-alpha.yml",
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
  };
  validateProvenance(statement, manifest);
  assert.throws(() => validateProvenance(statement, { ...manifest, commit: "b".repeat(40) }));
  assert.throws(() => validateProvenance(statement, { ...manifest, integrity: "sha512-b3RoZXI=" }));
  statement.predicate.buildDefinition.externalParameters.workflow.path =
    ".github/workflows/unreviewed.yml";
  assert.throws(() => validateProvenance(statement, manifest));
});
