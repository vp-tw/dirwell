import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAudit } from "../scripts/audit-dependencies.mjs";

const advisory = {
  github_advisory_id: "GHSA-vfj7-8cjw-p6xm",
  module_name: "braces",
  severity: "high",
  patched_versions: null,
  findings: [
    {
      version: "3.0.3",
      paths: [
        ".>@farmfe/core>chokidar>braces",
        ".>unplugin>@farmfe/core>fast-glob>micromatch>braces",
      ],
    },
  ],
};
const report = (value) => ({
  advisories: { 1: value },
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 } },
});
test("audit retains only exact reviewed Farm findings and fails on changed exposure or a fix", () => {
  assert.equal(evaluateAudit(report(advisory)).accepted.length, 1);
  for (const changed of [
    { ...advisory, github_advisory_id: "GHSA-new-advisory" },
    { ...advisory, severity: "critical" },
    { ...advisory, patched_versions: ">=3.0.4" },
    { ...advisory, findings: [{ version: "3.0.4", paths: advisory.findings[0].paths }] },
    { ...advisory, findings: [{ version: "3.0.3", paths: [".>c12>braces"] }] },
    { ...advisory, findings: [] },
  ])
    assert.equal(evaluateAudit(report(changed)).rejected.length, 1);
});
test("audit rejects missing and contradictory reports rather than treating them as clean", () => {
  assert.throws(
    () => evaluateAudit({ advisories: {}, metadata: { vulnerabilities: {} } }),
    /severity counts/,
  );
  assert.throws(() => evaluateAudit({ error: "registry unavailable" }), /complete report/);
  assert.throws(
    () =>
      evaluateAudit({
        advisories: {},
        metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 } },
      }),
    /counts conflict/,
  );
  assert.deepEqual(
    evaluateAudit({
      advisories: {},
      metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 } },
    }),
    {
      accepted: [],
      rejected: [],
    },
  );
});
