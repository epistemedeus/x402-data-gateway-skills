import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(root, "skills/lockfile-defect-report/scripts/report.mjs");
const fixtures = path.join(root, "tests/fixtures/lockfile-defect-report");
const documented = "node n-bty-003-kit-0.1.0/engine/bin/lockfile-delta.mjs --before before.json --after after.json --out-dir result";

let installed;
const temps = [];

function keep(dir) {
  temps.push(dir);
  return dir;
}

function run(args) {
  const child = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  let body = null;
  try { body = JSON.parse(child.stdout); } catch { body = null; }
  return { status: child.status, body, stdout: child.stdout, stderr: child.stderr };
}

function pair(name) {
  return {
    before: path.join(fixtures, name, "before.json"),
    after: path.join(fixtures, name, "after.json"),
    expected: path.join(fixtures, name, "expected.json"),
  };
}

function freshOut() {
  return path.join(keep(mkdtempSync(path.join(tmpdir(), "nbty-out-"))), "out");
}

function report(name, extra = [], expectedName = "expected.json") {
  const out = freshOut();
  const result = run([
    "report",
    "--kit", installed.kit,
    "--archive", installed.archive,
    "--offer", installed.offer,
    "--before", path.join(fixtures, name, "before.json"),
    "--after", path.join(fixtures, name, "after.json"),
    "--expected", path.join(fixtures, name, expectedName),
    "--out", out,
    ...extra,
  ]);
  return { ...result, out };
}

function direct(name) {
  const cwd = keep(mkdtempSync(path.join(tmpdir(), "nbty-cli-")));
  cpSync(installed.kit, path.join(cwd, "n-bty-003-kit-0.1.0"), { recursive: true });
  cpSync(path.join(fixtures, name, "before.json"), path.join(cwd, "before.json"));
  cpSync(path.join(fixtures, name, "after.json"), path.join(cwd, "after.json"));
  const child = spawnSync(process.execPath, [
    "n-bty-003-kit-0.1.0/engine/bin/lockfile-delta.mjs",
    "--before", "before.json",
    "--after", "after.json",
    "--out-dir", "result",
  ], { cwd, encoding: "utf8" });
  const artifactPath = path.join(cwd, "result", "pin-delta.json");
  const bytes = existsSync(artifactPath) ? readFileSync(artifactPath) : null;
  return {
    status: child.status,
    stdout: child.stdout ? JSON.parse(child.stdout) : null,
    stderr: child.stderr,
    artifact: bytes ? JSON.parse(bytes.toString("utf8")) : null,
    digest: bytes ? createHash("sha256").update(bytes).digest("hex") : null,
  };
}

function writeOffer(mutate) {
  const offer = JSON.parse(readFileSync(installed.offer, "utf8"));
  mutate(offer);
  const file = path.join(keep(mkdtempSync(path.join(tmpdir(), "nbty-offer-"))), "offer.json");
  writeFileSync(file, JSON.stringify(offer));
  return file;
}

before(() => {
  const work = path.join(keep(mkdtempSync(path.join(tmpdir(), "nbty-acquire-"))), "work");
  const result = run(["acquire", "--work", work]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  installed = {
    work,
    kit: result.body.kitDir,
    archive: path.join(work, "n-bty-003-kit-0.1.0.tar.gz"),
    offer: path.join(work, "offer.json"),
    body: result.body,
  };
});

after(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

test("acquire verifies the pinned kit and does not run the owner fixture", () => {
  assert.equal(installed.body.phase, "install");
  assert.equal(installed.body.submitted, false);
  assert.equal(installed.body.paidClaim, false);
  assert.equal(installed.body.reproduceRan, false);
  assert.equal(installed.body.ownerFixtureUsed, false);
  assert.equal(installed.body.identity.status, "agreed");
  assert.equal(installed.body.archive.sha256, "613df234495f926963526928457eb460877908652410b6b16adf09d6481b12dc");
  assert.equal(installed.body.archive.bytes, 13891);
  assert.equal(installed.body.archive.members, 25);
  assert.equal(installed.body.offer.reward.amount, "0.10");
  assert.equal(installed.body.offer.reward.totalOneReward, "0.10");
  assert.equal(existsSync(path.join(installed.kit, "fixtures", "owner-fixture.json")), true);
  assert.equal(existsSync(path.join(installed.kit, "engine", "bin", "lockfile-delta.mjs")), true);
  assert.equal(existsSync(path.join(installed.work, "result")), false);
});

test("acquire refuses an offer whose engine commit disagrees before download", () => {
  const offer = writeOffer((value) => { value.engine.commit = "0".repeat(40); });
  const work = path.join(keep(mkdtempSync(path.join(tmpdir(), "nbty-bad-acquire-"))), "work");
  const result = run(["acquire", "--work", work, "--offer", offer]);
  assert.equal(result.status, 3, result.stdout);
  assert.equal(result.body.outcome, "identity_unknown");
  assert.equal(result.body.phase, "install");
  assert.equal(existsSync(path.join(work, "n-bty-003-kit-0.1.0.tar.gz")), false);
  assert.equal(result.stdout.includes("fixture-alpha"), false);
});

test("the documented relative command reports a resolved-only edit", () => {
  const got = direct("resolved-only");
  assert.equal(got.status, 0, JSON.stringify(got.stdout));
  assert.equal(got.stderr, "");
  assert.equal(got.stdout.digest, got.digest);
  assert.equal(got.stdout.purchaseAuthority, false);
  assert.equal(got.artifact.status, "actionable");
  assert.equal(got.artifact.purchaseAuthority, false);
  assert.equal(got.artifact.provenance, "caller-supplied");
  assert.equal(got.artifact.lockfileVersion.before, 3);
  assert.deepEqual(got.artifact.counts, {
    beforePins: 1, afterPins: 1, added: 0, removed: 0, changed: 1, unchanged: 0, missingIntegrity: 0,
  });
  assert.equal(got.artifact.changed.length, 1);
  assert.equal(got.artifact.changed[0].id, "node_modules/control");
  assert.deepEqual(got.artifact.changed[0].changeKinds, ["resolved"]);
  assert.equal(got.artifact.changed[0].before.resolved, "https://registry.invalid/control-1.0.0.tgz");
  assert.equal(got.artifact.changed[0].after.resolved, "https://registry.invalid/relocated/control-1.0.0.tgz");
});

test("an unchanged v2 control is informational", () => {
  const got = direct("unchanged");
  assert.equal(got.status, 0);
  assert.equal(got.stdout.digest, got.digest);
  assert.equal(got.artifact.status, "informational");
  assert.equal(got.artifact.lockfileVersion.before, 2);
  assert.equal(got.artifact.lockfileVersion.after, 2);
  assert.equal(got.artifact.counts.changed, 0);
  assert.equal(got.artifact.counts.unchanged, 1);
  assert.equal(got.artifact.counts.missingIntegrity, 0);
  assert.deepEqual(got.artifact.changed, []);
});

test("a link target switch is omitted and stays partial", () => {
  const got = direct("link-target");
  assert.equal(got.status, 0);
  assert.equal(got.stdout.digest, got.digest);
  assert.equal(got.artifact.status, "partial");
  assert.deepEqual(got.artifact.counts, {
    beforePins: 2, afterPins: 2, added: 0, removed: 0, changed: 0, unchanged: 2, missingIntegrity: 2,
  });
  assert.equal(JSON.stringify(got.artifact).includes("node_modules/localpkg"), false);
});

test("a resolved git edit without integrity stays partial and is still listed", () => {
  const got = direct("git-partial");
  assert.equal(got.status, 0);
  assert.equal(got.artifact.status, "partial");
  assert.equal(got.artifact.counts.changed, 1);
  assert.equal(got.artifact.counts.missingIntegrity, 1);
  assert.equal(got.artifact.changed[0].id, "node_modules/gitpkg");
  assert.deepEqual(got.artifact.changed[0].changeKinds, ["resolved"]);
  assert.equal(got.artifact.gaps.length > 0, true);
});

test("a workspace link version edit is reported on the source path", () => {
  const got = direct("workspace-link");
  assert.equal(got.status, 0);
  assert.equal(got.artifact.status, "partial");
  assert.equal(got.artifact.changed.length, 1);
  assert.equal(got.artifact.changed[0].id, "packages/widget");
  assert.deepEqual(got.artifact.changed[0].changeKinds, ["version"]);
  assert.equal(got.artifact.changed[0].before.version, "1.0.0");
  assert.equal(got.artifact.changed[0].after.version, "1.0.1");
  assert.equal(JSON.stringify(got.artifact.changed).includes("node_modules/workspace-widget"), false);
});

test("a missing engine input is a refusal and writes no artifact", () => {
  const cwd = keep(mkdtempSync(path.join(tmpdir(), "nbty-missing-")));
  const child = spawnSync(process.execPath, [
    path.join(installed.kit, "engine/bin/lockfile-delta.mjs"),
    "--before", path.join(cwd, "missing.json"),
    "--after", pair("unchanged").after,
    "--out-dir", path.join(cwd, "result"),
  ], { encoding: "utf8" });
  const stdout = JSON.parse(child.stdout);
  assert.equal(child.status, 2);
  assert.equal(stdout.ok, false);
  assert.equal(stdout.code, "missing-input-file");
  assert.equal(stdout.purchaseAuthority, false);
  assert.equal(existsSync(path.join(cwd, "result")), false);
});

test("package.json-only input is an engine refusal", () => {
  const got = direct("not-a-lock");
  assert.equal(got.status, 2);
  assert.equal(got.stdout.code, "package-json-only");
  assert.equal(got.stdout.purchaseAuthority, false);
  assert.equal(got.artifact, null);
});

test("a matching resolved-only pair is a stopping point even if the note names issue 128", () => {
  const offer = JSON.parse(readFileSync(installed.offer, "utf8"));
  const got = report("resolved-only");
  assert.equal(got.status, 0, got.stdout);
  assert.equal(got.body.outcome, "stopping_point");
  assert.equal(got.body.reason, "expected_matches_observed");
  assert.equal(got.body.phase, "report_preparation");
  assert.equal(got.body.submitted, false);
  assert.equal(got.body.paidClaim, false);
  assert.equal(got.body.rewardPromised, false);
  assert.equal(got.body.customerRevenueClaim, false);
  assert.equal(got.body.inputs.labeledQa, true);
  assert.equal(got.body.inputs.ownerFixtureUsed, false);
  assert.equal(got.body.documentedLimits.knownIssue, null);
  assert.equal(got.body.documentedLimits.installedLinkProjection.matched, false);
  assert.equal(got.body.documentedLimits.issue128Behavior, false);
  assert.equal(got.body.offer.reward.amount, "0.10");
  assert.deepEqual(got.body.offer.inScope, offer.inScope);
  assert.deepEqual(got.body.offer.outOfScope, offer.outOfScope);
  assert.equal(got.body.offer.boundary, offer.boundary);
  assert.equal(got.body.execution.documentedCommand, documented);
  assert.equal(got.body.execution.exit, 0);
  assert.equal(got.body.execution.argv.some((part) => part.endsWith("engine/bin/lockfile-delta.mjs")), true);
  assert.deepEqual(got.body.execution.argv.filter((part) => part.startsWith("--")), ["--before", "--after", "--out-dir"]);
  assert.equal(got.body.execution.artifact.digestAgrees, true);
  assert.equal(got.body.execution.artifact.purchaseAuthority, false);
  assert.equal(got.body.execution.artifact.status, "actionable");
  assert.equal(got.body.execution.artifact.changed[0].id, "node_modules/control");
  assert.equal(got.stdout.includes("fixture-alpha"), false);
  const prose = readFileSync(path.join(got.out, "report.md"), "utf8");
  assert.equal(prose.includes(got.body.execution.artifact.sha256), true);
  assert.equal(prose.includes("not a submission"), true);
});

test("the unchanged control report matches the caller's expected projection", () => {
  const got = report("unchanged");
  assert.equal(got.status, 0, got.stdout);
  assert.equal(got.body.reason, "expected_matches_observed");
  assert.equal(got.body.execution.artifact.status, "informational");
  assert.equal(got.body.execution.artifact.counts.changed, 0);
  assert.equal(got.body.execution.artifact.lockfileVersion.before, 2);
});

test("the link target switch stops on the documented exclusion without naming issue 128", () => {
  const got = report("link-target");
  assert.equal(got.status, 0, got.stdout);
  assert.equal(got.body.outcome, "stopping_point");
  assert.equal(got.body.reason, "documented_behavior");
  assert.equal(got.body.documentedLimits.targetSwitchBehavior, true);
  assert.equal(got.body.documentedLimits.issue128Behavior, false);
  assert.equal(got.body.documentedLimits.knownIssue, null);
  assert.equal(got.body.documentedLimits.installedLinkProjection.matched, true);
  assert.deepEqual(got.body.execution.artifact.counts, {
    beforePins: 2, afterPins: 2, added: 0, removed: 0, changed: 0, unchanged: 2, missingIntegrity: 2,
  });
  assert.equal(got.body.submitted, false);
});

test("a git resolved edit stops on the documented missing-integrity partial result", () => {
  const got = report("git-partial");
  assert.equal(got.status, 0, got.stdout);
  assert.equal(got.body.reason, "documented_behavior");
  assert.equal(got.body.documentedLimits.missingIntegrityPartial.matched, true);
  assert.equal(got.body.documentedLimits.missingIntegrityPartial.listedDeltas, 1);
  assert.equal(got.body.documentedLimits.knownIssue, null);
  assert.equal(got.body.execution.artifact.changed[0].id, "node_modules/gitpkg");
  assert.deepEqual(got.body.execution.artifact.changed[0].changeKinds, ["resolved"]);
});

test("the workspace link shape matches issue 128 by behavior", () => {
  const got = report("workspace-link");
  assert.equal(got.status, 0, got.stdout);
  assert.equal(got.body.reason, "documented_behavior");
  assert.equal(got.body.documentedLimits.issue128Behavior, true);
  assert.equal(got.body.documentedLimits.knownIssue.number, 128);
  assert.equal(got.body.documentedLimits.knownIssue.matchedBy, "behavior");
  assert.equal(got.body.execution.artifact.changed[0].id, "packages/widget");
  assert.equal(got.body.execution.artifact.changed[0].before.version, "1.0.0");
  assert.equal(got.body.execution.artifact.changed[0].after.version, "1.0.1");
});

test("a link note does not classify a real registry edit as issue 128", () => {
  const got = report("link-plus-registry");
  assert.equal(got.status, 0, got.stdout);
  assert.equal(got.body.outcome, "candidate_report");
  assert.equal(got.body.reason, "unexplained_difference");
  assert.equal(got.body.documentedLimits.knownIssue, null);
  assert.equal(got.body.documentedLimits.issue128Behavior, false);
  assert.equal(got.body.execution.artifact.changed.length, 1);
  assert.equal(got.body.execution.artifact.changed[0].id, "node_modules/control");
  assert.equal(got.body.comparison.unexplained.some((item) => item.id === "node_modules/localpkg"), true);
});

test("calling a resolved-only edit partial does not make the missing-integrity limit match", () => {
  const got = report("resolved-only", [], "expected-partial-keyword.json");
  assert.equal(got.status, 0, got.stdout);
  assert.equal(got.body.outcome, "candidate_report");
  assert.equal(got.body.documentedLimits.missingIntegrityPartial.matched, false);
  assert.equal(got.body.documentedLimits.knownIssue, null);
  assert.equal(got.body.execution.artifact.status, "actionable");
  assert.equal(got.body.execution.artifact.counts.missingIntegrity, 0);
});

test("package.json input prepares an engine refusal instead of a candidate defect", () => {
  const got = report("not-a-lock");
  assert.equal(got.status, 0, got.stdout);
  assert.equal(got.body.reason, "engine_refused");
  assert.equal(got.body.documentedLimits.engineRefusal, "package-json-only");
  assert.equal(got.body.execution.exit, 2);
  assert.equal(got.body.submitted, false);
});

test("missing caller inputs stay missing and do not use the owner fixture", () => {
  const out = freshOut();
  const result = run([
    "report",
    "--kit", installed.kit,
    "--archive", installed.archive,
    "--before", pair("resolved-only").before,
    "--after", pair("resolved-only").after,
    "--out", out,
  ]);
  assert.equal(result.status, 2);
  assert.equal(result.body.code, "missing_input");
  assert.equal(result.body.missing.includes("expected"), true);
  assert.equal(result.body.ownerFixtureUsed, false);
  assert.equal(existsSync(out), false);
  assert.equal(result.stdout.includes("fixture-alpha"), false);
  const noBefore = freshOut();
  const missingBefore = run([
    "report",
    "--kit", installed.kit,
    "--archive", installed.archive,
    "--after", pair("resolved-only").after,
    "--expected", pair("resolved-only").expected,
    "--out", noBefore,
  ]);
  assert.equal(missingBefore.status, 2);
  assert.equal(missingBefore.body.missing.includes("before"), true);
  assert.equal(existsSync(noBefore), false);
});

test("a mode 000 owner fixture is not read while preparing a caller report", () => {
  const kit = path.join(keep(mkdtempSync(path.join(tmpdir(), "nbty-kit-"))), "kit");
  cpSync(installed.kit, kit, { recursive: true });
  const fixture = path.join(kit, "fixtures", "owner-fixture.json");
  chmodSync(fixture, 0);
  try {
    const out = freshOut();
    const got = run([
      "report",
      "--kit", kit,
      "--archive", installed.archive,
      "--offer", installed.offer,
      "--before", pair("resolved-only").before,
      "--after", pair("resolved-only").after,
      "--expected", pair("resolved-only").expected,
      "--out", out,
    ]);
    assert.equal(got.status, 0, got.stdout);
    assert.equal(got.body.inputs.ownerFixtureUsed, false);
    assert.equal(got.stdout.includes("fixture-lock-app"), false);
  } finally {
    chmodSync(fixture, 0o644);
  }
});

test("an offer engine commit that disagrees with the kit does not run the engine", () => {
  const offer = writeOffer((value) => { value.engine.commit = "0".repeat(40); });
  const out = freshOut();
  const got = run([
    "report",
    "--kit", installed.kit,
    "--archive", installed.archive,
    "--offer", offer,
    "--before", pair("workspace-link").before,
    "--after", pair("workspace-link").after,
    "--expected", pair("workspace-link").expected,
    "--out", out,
  ]);
  assert.equal(got.status, 3, got.stdout);
  assert.equal(got.body.outcome, "identity_unknown");
  assert.equal(got.body.execution, null);
  assert.equal(got.body.documentedLimits.status, "unknown");
  assert.equal(got.body.documentedLimits.knownIssue, null);
  assert.equal(existsSync(path.join(out, "result", "pin-delta.json")), false);
});

test("an archive hash that disagrees with the offer does not run the engine", () => {
  const archive = path.join(keep(mkdtempSync(path.join(tmpdir(), "nbty-archive-"))), "kit.tar.gz");
  const bytes = readFileSync(installed.archive);
  bytes[bytes.length - 1] ^= 0xff;
  writeFileSync(archive, bytes);
  const out = freshOut();
  const got = run([
    "report",
    "--kit", installed.kit,
    "--archive", archive,
    "--offer", installed.offer,
    "--before", pair("resolved-only").before,
    "--after", pair("resolved-only").after,
    "--expected", pair("resolved-only").expected,
    "--out", out,
  ]);
  assert.equal(got.status, 3, got.stdout);
  assert.equal(got.body.execution, null);
  assert.equal(got.body.identity.status, "refresh_or_unknown");
  assert.equal(got.body.documentedLimits.knownIssue, null);
});

test("disagreeing vendor trees inside the offer are refresh or unknown", () => {
  const offer = writeOffer((value) => { value.preflight.engine.source.vendorTree = "0".repeat(40); });
  const out = freshOut();
  const got = run([
    "report",
    "--kit", installed.kit,
    "--archive", installed.archive,
    "--offer", offer,
    "--before", pair("resolved-only").before,
    "--after", pair("resolved-only").after,
    "--expected", pair("resolved-only").expected,
    "--out", out,
  ]);
  assert.equal(got.status, 3, got.stdout);
  assert.equal(got.body.identity.status, "refresh_or_unknown");
  assert.equal(got.body.execution, null);
  assert.equal(got.body.identity.disagreements.some((item) => item.field === "offer.preflight.engine.vendorTree"), true);
});

test("a self-consistent offer and kit that miss the pin record the artifact without old limits", () => {
  const commit = "1".repeat(40);
  const kit = path.join(keep(mkdtempSync(path.join(tmpdir(), "nbty-stale-"))), "kit");
  cpSync(installed.kit, kit, { recursive: true });
  for (const relative of ["SOURCE.txt", "engine/SOURCE.txt"]) {
    const file = path.join(kit, relative);
    writeFileSync(file, readFileSync(file, "utf8").replaceAll("ca38205279f0d543515b81b7261909e55ea2600f", commit));
  }
  const offer = writeOffer((value) => {
    value.engine.commit = commit;
    value.preflight.engine.source.commit = commit;
    value.preflight.kit.engine.commit = commit;
  });
  const out = freshOut();
  const got = run([
    "report",
    "--kit", kit,
    "--archive", installed.archive,
    "--offer", offer,
    "--before", pair("workspace-link").before,
    "--after", pair("workspace-link").after,
    "--expected", pair("workspace-link").expected,
    "--out", out,
  ]);
  assert.equal(got.status, 3, got.stdout);
  assert.equal(got.body.outcome, "identity_unknown");
  assert.equal(got.body.identity.documentedLimitsCurrent, false);
  assert.equal(got.body.documentedLimits.status, "unknown");
  assert.equal(got.body.documentedLimits.knownIssue, null);
  assert.equal(got.body.execution.exit, 0);
  assert.equal(got.body.execution.artifact.changed[0].id, "packages/widget");
  assert.equal(existsSync(path.join(out, "result", "pin-delta.json")), true);
});

test("a self-consistent stale pin does not name a known engine refusal", () => {
  const commit = "2".repeat(40);
  const kit = path.join(keep(mkdtempSync(path.join(tmpdir(), "nbty-stale-refusal-"))), "kit");
  cpSync(installed.kit, kit, { recursive: true });
  for (const relative of ["SOURCE.txt", "engine/SOURCE.txt"]) {
    const file = path.join(kit, relative);
    writeFileSync(file, readFileSync(file, "utf8").replaceAll("ca38205279f0d543515b81b7261909e55ea2600f", commit));
  }
  const offer = writeOffer((value) => {
    value.engine.commit = commit;
    value.preflight.engine.source.commit = commit;
    value.preflight.kit.engine.commit = commit;
  });
  const out = freshOut();
  const got = run([
    "report",
    "--kit", kit,
    "--archive", installed.archive,
    "--offer", offer,
    "--before", pair("not-a-lock").before,
    "--after", pair("not-a-lock").after,
    "--expected", pair("not-a-lock").expected,
    "--out", out,
  ]);
  assert.equal(got.status, 3, got.stdout);
  assert.equal(got.body.outcome, "identity_unknown");
  assert.equal(got.body.reason, "refresh_or_unknown");
  assert.equal(got.body.documentedLimits.status, "unknown");
  assert.equal(got.body.documentedLimits.knownIssue, null);
  assert.equal(got.body.documentedLimits.engineRefusal, undefined);
  assert.equal(got.body.execution.exit, 2);
  assert.equal(got.body.execution.stdout.code, "package-json-only");
  assert.equal(got.body.comparison.equal, null);
});

test("a changed reward is preserved and is not treated as the original terms", () => {
  const offer = writeOffer((value) => { value.reward.amount = "0.50"; });
  const out = freshOut();
  const got = run([
    "report",
    "--kit", installed.kit,
    "--archive", installed.archive,
    "--offer", offer,
    "--before", pair("resolved-only").before,
    "--after", pair("resolved-only").after,
    "--expected", pair("resolved-only").expected,
    "--out", out,
  ]);
  assert.equal(got.status, 3, got.stdout);
  assert.equal(got.body.outcome, "identity_unknown");
  assert.equal(got.body.identity.termsStatus, "refresh_or_unknown");
  assert.equal(got.body.offer.reward.amount, "0.50");
  assert.equal(got.body.behavior.outcome, "stopping_point");
  assert.equal(got.body.submitted, false);
  assert.equal(got.body.rewardPromised, false);
});

test("payment and submission flags stop before a report", () => {
  const out = freshOut();
  const got = run([
    "report",
    "--submit",
    "--kit", installed.kit,
    "--archive", installed.archive,
    "--offer", installed.offer,
    "--before", pair("resolved-only").before,
    "--after", pair("resolved-only").after,
    "--expected", pair("resolved-only").expected,
    "--out", out,
  ]);
  assert.equal(got.status, 2);
  assert.equal(got.body.code, "refused_flag");
  assert.equal(got.body.submitted, false);
  assert.equal(existsSync(out), false);
});
