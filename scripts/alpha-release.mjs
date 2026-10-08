import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const repository = "vp-tw/dirwell";
const artifactDirectory = ".release-artifact";

export function validateRelease(metadata, environment) {
  assert.equal(environment.GITHUB_REPOSITORY, repository, "Unexpected repository");
  assert.equal(environment.GITHUB_REF, "refs/heads/main", "Publish only from main");
  assert.equal(environment.GITHUB_EVENT_NAME, "workflow_dispatch", "Manual dispatch required");
  assert.match(environment.GITHUB_SHA ?? "", /^[a-f0-9]{40}$/, "Expected exact commit");
  assert.equal(metadata.name, "@vp-tw/dirwell");
  assert.match(metadata.version, /^\d+\.\d+\.\d+-alpha\.\d+$/, "Alpha versions only");
  assert.equal(
    environment.RELEASE_VERSION,
    metadata.version,
    "Requested version must match source",
  );
  assert.equal(metadata.publishConfig?.tag, "alpha");
  assert.equal(metadata.publishConfig?.access, "public");
  assert.equal(metadata.repository?.url, `git+https://github.com/${repository}.git`);
}

export function validateProvenance(statement, manifest) {
  assert.equal(statement.predicateType, "https://slsa.dev/provenance/v1");
  const definition = statement.predicate.buildDefinition;
  assert.deepEqual(definition.externalParameters.workflow, {
    ref: "refs/heads/main",
    repository: `https://github.com/${repository}`,
    path: ".github/workflows/publish-alpha.yml",
  });
  assert.ok(
    definition.resolvedDependencies.some(
      (dependency) =>
        dependency.digest?.gitCommit === manifest.commit &&
        dependency.uri === `git+https://github.com/${repository}@refs/heads/main`,
    ),
    "Provenance must reference the released source commit",
  );
  const digest = Buffer.from(manifest.integrity.slice("sha512-".length), "base64").toString("hex");
  assert.ok(
    statement.subject.some((subject) => subject.digest?.sha512 === digest),
    "Provenance artifact digest mismatch",
  );
}

async function registryMetadata(version) {
  const response = await fetch(`https://registry.npmjs.org/@vp-tw%2fdirwell/${version}`);
  if (response.status === 404) return null;
  assert.ok(response.ok, `Registry returned ${response.status}`);
  return response.json();
}

async function main(mode) {
  const metadata = JSON.parse(await readFile("package.json", "utf8"));
  validateRelease(metadata, process.env);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.equal(commit, process.env.GITHUB_SHA);
  execFileSync("git", ["diff", "--exit-code", "HEAD"], { stdio: "inherit" });
  if (mode === "prepare") {
    await mkdir(artifactDirectory, { recursive: true });
    const result = JSON.parse(
      execFileSync("npm", ["pack", "--json", "--pack-destination", artifactDirectory], {
        encoding: "utf8",
      }),
    );
    const [artifact] = Array.isArray(result) ? result : Object.values(result);
    assert.equal(artifact.name, metadata.name);
    assert.equal(artifact.version, metadata.version);
    assert.match(artifact.filename, /^vp-tw-dirwell-[\d.]+-alpha\.\d+\.tgz$/);
    await writeFile(
      `${artifactDirectory}/manifest.json`,
      JSON.stringify(
        {
          name: metadata.name,
          version: metadata.version,
          commit,
          filename: artifact.filename,
          integrity: artifact.integrity,
        },
        null,
        2,
      ),
    );
    return;
  }
  const manifest = JSON.parse(await readFile(`${artifactDirectory}/manifest.json`, "utf8"));
  assert.equal(manifest.version, metadata.version);
  assert.equal(manifest.commit, commit);
  assert.equal(manifest.name, metadata.name);
  assert.equal(manifest.filename, `vp-tw-dirwell-${metadata.version}.tgz`);
  const tarball = await readFile(`${artifactDirectory}/${manifest.filename}`);
  assert.equal(
    `sha512-${createHash("sha512").update(tarball).digest("base64")}`,
    manifest.integrity,
  );
  if (mode === "publish") {
    const existing = await registryMetadata(metadata.version);
    if (existing) {
      assert.equal(
        existing.dist.integrity,
        manifest.integrity,
        "Existing version contains different bytes",
      );
      console.log("Version already exists with identical bytes; verifying without republishing.");
    } else {
      execFileSync(
        "npm",
        [
          "publish",
          `${artifactDirectory}/${manifest.filename}`,
          "--tag",
          "alpha",
          "--access",
          "public",
          "--provenance",
        ],
        { stdio: "inherit" },
      );
    }
  } else {
    assert.equal(mode, "readback");
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const published = await registryMetadata(metadata.version);
    if (published?.dist?.attestations?.url) {
      assert.equal(published.dist.integrity, manifest.integrity);
      const tags = await fetch("https://registry.npmjs.org/-/package/@vp-tw%2fdirwell/dist-tags");
      assert.ok(tags.ok);
      assert.equal((await tags.json()).alpha, metadata.version);
      const response = await fetch(published.dist.attestations.url);
      assert.ok(response.ok);
      const attestations = await response.json();
      const provenance = attestations.attestations.find(
        (entry) => entry.predicateType === "https://slsa.dev/provenance/v1",
      );
      assert.ok(provenance, "Missing SLSA provenance");
      const statement = JSON.parse(
        Buffer.from(provenance.bundle.dsseEnvelope.payload, "base64").toString("utf8"),
      );
      validateProvenance(statement, manifest);
      await writeFile(
        `${artifactDirectory}/registry-proof.json`,
        JSON.stringify({ manifest, dist: published.dist, statement }, null, 2),
      );
      console.log(
        `Registry integrity, alpha tag, source commit, and provenance payload verified for ${metadata.version}.`,
      );
      return;
    }
    console.log(`Waiting for registry/provenance propagation (${attempt + 1}/20).`);
    await new Promise((resolve) => setTimeout(resolve, 30_000));
  }
  throw new Error(
    "Registry/provenance readback timed out; retry readback, never republish different bytes.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main(process.argv[2]);
