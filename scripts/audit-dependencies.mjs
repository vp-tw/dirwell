import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const retained = {
  "GHSA-vfj7-8cjw-p6xm": { module: "braces", version: "3.0.3", severity: "high" },
  "GHSA-hp3w-g68c-fv3c": { module: "sprintf-js", version: "1.0.3", severity: "moderate" },
};

/** Keep raw advisories visible; only the documented Farm development graph is retained. */
export function evaluateAudit(report) {
  if (
    !report ||
    typeof report !== "object" ||
    !report.advisories ||
    !report.metadata?.vulnerabilities
  ) {
    throw new Error("Dependency audit did not return a complete report");
  }
  const counts = report.metadata.vulnerabilities;
  if (
    Array.isArray(report.advisories) ||
    !["info", "low", "moderate", "high", "critical"].every(
      (key) => Number.isInteger(counts[key]) && counts[key] >= 0,
    )
  ) {
    throw new Error("Dependency audit did not return complete severity counts");
  }
  const accepted = [],
    rejected = [];
  for (const advisory of Object.values(report.advisories)) {
    const id = advisory.github_advisory_id;
    const exception = retained[id];
    const findings = advisory.findings;
    const matches =
      exception !== undefined &&
      advisory.module_name === exception.module &&
      advisory.severity === exception.severity &&
      advisory.patched_versions === null &&
      Array.isArray(findings) &&
      findings.length > 0 &&
      findings.every(
        (finding) =>
          finding.version === exception.version &&
          Array.isArray(finding.paths) &&
          finding.paths.length > 0 &&
          finding.paths.every(
            (dependencyPath) =>
              typeof dependencyPath === "string" &&
              (dependencyPath.startsWith(".>@farmfe/core>") ||
                dependencyPath.startsWith(".>unplugin>@farmfe/core>")),
          ),
      );
    (matches ? accepted : rejected).push({
      id,
      module: advisory.module_name,
      severity: advisory.severity,
      url: advisory.url,
    });
  }
  if (
    Object.keys(report.advisories).length === 0 &&
    Object.values(report.metadata.vulnerabilities).some((count) => count !== 0)
  ) {
    throw new Error("Dependency audit counts conflict with its advisory list");
  }
  return { accepted, rejected };
}

export function main() {
  let output;
  try {
    output = execFileSync("pnpm", ["audit", "--json"], {
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    if (error.status !== 1 || typeof error.stdout !== "string") throw error;
    output = error.stdout;
  }
  const { accepted, rejected } = evaluateAudit(JSON.parse(output));
  for (const item of accepted)
    console.log(`Retained ${item.severity} advisory: ${item.module} ${item.id} ${item.url}`);
  for (const item of rejected)
    console.error(`Unreviewed or changed advisory: ${item.module} ${item.id} ${item.url}`);
  console.log(
    `${accepted.length} documented Farm development advisories; ${rejected.length} unreviewed advisories. Raw pnpm audit remains unchanged.`,
  );
  if (rejected.length > 0) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
