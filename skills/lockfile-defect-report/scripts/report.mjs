#!/usr/bin/env node
/**
 * Install the pinned N-BTY-003 kit and prepare a caller-owned defect report.
 * Does not clone Git, submit an issue, award a bounty, or spend.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PINS = JSON.parse(readFileSync(path.join(HERE, "../references/pins.json"), "utf8"));
const COUNT_KEYS = ["beforePins", "afterPins", "added", "removed", "changed", "unchanged", "missingIntegrity"];
const REFUSAL_FLAGS = ["submit", "award", "pay", "settle", "sign", "wallet", "claim"];
const KNOWN_ENGINE_REFUSALS = new Set(["html-input", "package-json-only", "unsupported-lockfile-version"]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      out._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function emit(payload, code) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exit(code);
}

function fail(code, extra, exitCode) {
  emit({
    ok: false,
    schema: "neomorphic.lockfile-defect-report.v1",
    code,
    submitted: false,
    paidClaim: false,
    rewardPromised: false,
    ownerFixtureUsed: false,
    customerRevenueClaim: false,
    ...extra,
  }, exitCode);
}

function usage() {
  return `lockfile defect report

acquire downloads and verifies the pinned kit. It does not run the owner fixture.
report runs the maintained engine on a caller-owned pair and writes a report.
Neither command submits a claim or promises the 0.10 USDC award.

  node scripts/report.mjs acquire --work DIR
  node scripts/report.mjs report --kit KIT --archive FILE --before BEFORE --after AFTER --expected EXPECTED --out DIR

--offer FILE reads a caller-supplied offer snapshot. Without it, acquire and report
GET ${PINS.offerUrl}
`;
}

function regularFile(filePath) {
  let stat;
  try {
    stat = lstatSync(filePath);
  } catch (err) {
    if (err && err.code === "ENOENT") return { ok: false, reason: "missing" };
    throw err;
  }
  if (stat.isSymbolicLink()) return { ok: false, reason: "symlink" };
  if (!stat.isFile()) return { ok: false, reason: "not-file" };
  return { ok: true, bytes: stat.size };
}

function readJsonFile(filePath) {
  const info = regularFile(filePath);
  if (!info.ok) return { ok: false, reason: info.reason };
  const bytes = readFileSync(filePath);
  try {
    return { ok: true, value: JSON.parse(bytes.toString("utf8")), bytes: bytes.length, sha256: sha256(bytes) };
  } catch {
    return { ok: false, reason: "json" };
  }
}

function sourceCommit(text) {
  const commit = text.match(/commit(?:=|\s+)([0-9a-f]{40})/i)?.[1] ?? null;
  const repo = text.match(/copied_from=(\S+)/)?.[1]
    ?? text.match(/epistemedeus\/x402-url-extractor/)?.[0]
    ?? null;
  const enginePath = text.match(/path(?:=|\s+)(vendor\/lockfile-pin-delta)/)?.[1] ?? null;
  const merchantVersion = text.match(/merchant(?:_|\s+)version(?:=|\s+)([0-9.]+)/i)?.[1] ?? null;
  return { commit, repo, path: enginePath, merchantVersion };
}

function readKitSource(kitDir) {
  const kit = readFileSync(path.join(kitDir, "SOURCE.txt"), "utf8");
  const engine = readFileSync(path.join(kitDir, "engine", "SOURCE.txt"), "utf8");
  return { kit: sourceCommit(kit), engine: sourceCommit(engine) };
}

function archiveIdentity(filePath) {
  const info = regularFile(filePath);
  if (!info.ok) return { ok: false, reason: info.reason };
  const bytes = readFileSync(filePath);
  return { ok: true, bytes: bytes.length, sha256: sha256(bytes), path: path.resolve(filePath) };
}

export function compareIdentity({ offer, kitSource, archive }) {
  const disagreements = [];
  const differ = (field, actual, expected) => {
    if (actual !== expected) disagreements.push({ field, actual: actual ?? null, expected: expected ?? null });
  };
  differ("offer.id", offer?.id, PINS.offerId);
  differ("offer.engine.repo", offer?.engine?.repo, PINS.engine.repo);
  differ("offer.engine.commit", offer?.engine?.commit, PINS.engine.commit);
  differ("offer.engine.path", offer?.engine?.path, PINS.engine.path);
  differ("offer.kit.archiveUrl", offer?.kit?.archiveUrl, PINS.kit.archiveUrl);
  const preflightEngine = offer?.preflight?.engine?.source;
  const preflightKitEngine = offer?.preflight?.kit?.engine;
  const preflightKit = offer?.preflight?.kit?.identity;
  if (!preflightEngine) disagreements.push({ field: "offer.preflight.engine.source", actual: null, expected: "present" });
  else {
    differ("offer.preflight.engine.commit", preflightEngine.commit, PINS.engine.commit);
    differ("offer.preflight.engine.vendorTree", preflightEngine.vendorTree, PINS.engine.vendorTree);
  }
  if (!preflightKitEngine) disagreements.push({ field: "offer.preflight.kit.engine", actual: null, expected: "present" });
  else {
    differ("offer.preflight.kit.engine.commit", preflightKitEngine.commit, PINS.engine.commit);
    differ("offer.preflight.kit.engine.vendorTree", preflightKitEngine.vendorTree, PINS.engine.vendorTree);
  }
  if (!preflightKit) disagreements.push({ field: "offer.preflight.kit.identity", actual: null, expected: "present" });
  else {
    differ("offer.preflight.kit.sha256", preflightKit.sha256, PINS.kit.sha256);
    differ("offer.preflight.kit.bytes", preflightKit.bytes, PINS.kit.bytes);
  }
  if (kitSource) {
    differ("kit.SOURCE.commit", kitSource.kit?.commit, PINS.engine.commit);
    differ("kit.engine.SOURCE.commit", kitSource.engine?.commit, PINS.engine.commit);
    differ("kit.SOURCE.repo", kitSource.kit?.repo, PINS.engine.repo);
    differ("kit.SOURCE.path", kitSource.kit?.path, PINS.engine.path);
    differ("kit.engine.merchantVersion", kitSource.engine?.merchantVersion, PINS.engine.merchantVersion);
    if (kitSource.kit?.commit !== kitSource.engine?.commit) {
      disagreements.push({
        field: "kit.internal.commit",
        actual: kitSource.kit?.commit ?? null,
        expected: kitSource.engine?.commit ?? null,
      });
    }
  }
  if (archive) {
    differ("archive.sha256", archive.sha256, PINS.kit.sha256);
    differ("archive.bytes", archive.bytes, PINS.kit.bytes);
  }
  const termsDisagreements = [];
  const reward = offer?.reward ?? {};
  for (const key of Object.keys(PINS.originalTerms)) {
    if (reward[key] !== PINS.originalTerms[key]) {
      termsDisagreements.push({ field: `offer.reward.${key}`, actual: reward[key] ?? null, expected: PINS.originalTerms[key] });
    }
  }
  const offerKitRunnable = Boolean(
    offer?.engine?.commit
    && kitSource?.kit?.commit
    && offer.engine.commit === kitSource.kit.commit
    && offer.engine.commit === kitSource.engine?.commit
    && offer.engine.repo === kitSource.kit.repo
    && offer.engine.path === kitSource.kit.path
    && preflightEngine?.commit === offer.engine.commit
    && preflightKitEngine?.commit === offer.engine.commit
    && preflightEngine?.vendorTree
    && preflightEngine.vendorTree === preflightKitEngine?.vendorTree
    && archive?.sha256
    && preflightKit?.sha256 === archive.sha256
    && preflightKit?.bytes === archive.bytes,
  );
  return {
    status: disagreements.length === 0 ? "agreed" : "refresh_or_unknown",
    disagreements,
    termsStatus: termsDisagreements.length === 0 ? "agreed" : "refresh_or_unknown",
    termsDisagreements,
    documentedLimitsCurrent: disagreements.length === 0,
    offerKitRunnable,
  };
}

function packageEntries(doc) {
  if (!doc || typeof doc.packages !== "object" || doc.packages == null || Array.isArray(doc.packages)) return [];
  return Object.entries(doc.packages).filter(([id, entry]) => id !== "" && entry && typeof entry === "object" && !Array.isArray(entry));
}

function linkEntries(doc) {
  return packageEntries(doc).filter(([, entry]) => entry.link === true);
}

function normSide(side) {
  return {
    name: side?.name ?? null,
    version: side?.version ?? null,
    integrity: side?.integrity ?? null,
    resolved: side?.resolved ?? null,
  };
}

function normChanged(item) {
  return {
    id: item.id,
    name: item.name ?? null,
    changeKinds: [...(item.changeKinds ?? [])].sort(),
    before: normSide(item.before),
    after: normSide(item.after),
  };
}

function normPin(item) {
  return {
    id: item.id ?? null,
    name: item.name ?? null,
    version: item.version ?? null,
    integrity: item.integrity ?? null,
    resolved: item.resolved ?? null,
  };
}

function projectionFromArtifact(artifact) {
  return {
    status: artifact.status,
    counts: Object.fromEntries(COUNT_KEYS.map((key) => [key, artifact.counts?.[key]])),
    added: (artifact.added ?? []).map(normPin).sort(byId),
    removed: (artifact.removed ?? []).map(normPin).sort(byId),
    changed: (artifact.changed ?? []).map(normChanged).sort(byId),
  };
}

function byId(left, right) {
  return String(left.id).localeCompare(String(right.id));
}

function projectionFromExpected(expected) {
  return {
    status: expected.status,
    counts: Object.fromEntries(COUNT_KEYS.map((key) => [key, expected.counts?.[key]])),
    added: (expected.added ?? []).map(normPin).sort(byId),
    removed: (expected.removed ?? []).map(normPin).sort(byId),
    changed: (expected.changed ?? []).map(normChanged).sort(byId),
  };
}

function sameChanged(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nonLinkCount(doc) {
  return packageEntries(doc).filter(([, entry]) => entry.link !== true).length;
}

function linkProjection(beforeDoc, afterDoc, observed) {
  const ids = [...new Set([...linkEntries(beforeDoc), ...linkEntries(afterDoc)].map(([id]) => id))];
  const projected = new Set();
  for (const side of ["added", "removed", "changed"]) {
    for (const item of observed[side] ?? []) projected.add(item.id);
  }
  const absent = ids.length > 0 && ids.every((id) => !projected.has(id));
  const countsMatch = observed.counts.beforePins === nonLinkCount(beforeDoc) && observed.counts.afterPins === nonLinkCount(afterDoc);
  return { id: "installed-link-projection", matched: absent && countsMatch, linkIds: ids, absent, countsMatch };
}

function missingIntegrity(observed) {
  const matched = observed.status === "partial" && Number(observed.counts.missingIntegrity) > 0;
  return {
    id: "missing-integrity-partial",
    matched,
    status: observed.status,
    missingIntegrity: observed.counts.missingIntegrity,
    listedDeltas: Number(observed.counts.added) + Number(observed.counts.removed) + Number(observed.counts.changed),
  };
}

function linkTarget(beforeDoc, afterDoc, linkId) {
  for (const doc of [afterDoc, beforeDoc]) {
    const found = linkEntries(doc).find(([id]) => id === linkId);
    if (found && typeof found[1].resolved === "string" && found[1].resolved !== "") return found[1].resolved;
  }
  return null;
}

function issue128Behavior(beforeDoc, afterDoc, observed, link) {
  if (!link.matched || observed.status !== "partial" || !(observed.counts.missingIntegrity > 0) || observed.changed.length < 1) {
    return false;
  }
  const targets = new Set(link.linkIds.map((id) => linkTarget(beforeDoc, afterDoc, id)).filter(Boolean));
  return observed.changed.every((item) => {
    if (!targets.has(item.id) || link.linkIds.includes(item.id)) return false;
    if (!item.changeKinds.includes("version")) return false;
    return item.before.integrity == null && item.after.integrity == null && item.before.resolved == null && item.after.resolved == null;
  });
}

function nonLinkSignature(doc) {
  return packageEntries(doc)
    .filter(([, entry]) => entry.link !== true)
    .map(([id, entry]) => [id, JSON.stringify({
      name: entry.name ?? null,
      version: entry.version ?? null,
      integrity: entry.integrity ?? null,
      resolved: entry.resolved ?? null,
    })]);
}

function targetSwitchBehavior(beforeDoc, afterDoc, observed, link) {
  if (!link.matched || observed.counts.changed !== 0) return false;
  const beforeLinks = new Map(linkEntries(beforeDoc).map(([id, entry]) => [id, entry.resolved ?? null]));
  const afterLinks = new Map(linkEntries(afterDoc).map(([id, entry]) => [id, entry.resolved ?? null]));
  let switched = false;
  for (const [id, resolved] of beforeLinks) {
    if (afterLinks.has(id) && afterLinks.get(id) !== resolved) switched = true;
  }
  if (!switched) return false;
  const beforePins = new Map(nonLinkSignature(beforeDoc));
  const afterPins = new Map(nonLinkSignature(afterDoc));
  if (beforePins.size !== afterPins.size) return false;
  for (const [id, value] of beforePins) if (afterPins.get(id) !== value) return false;
  return observed.counts.unchanged === observed.counts.beforePins
    && (observed.status === "partial" || observed.status === "informational");
}

function versionsMatch(observedItem, expectedItem) {
  return observedItem.name === expectedItem.name
    && observedItem.before.version === expectedItem.before.version
    && observedItem.after.version === expectedItem.after.version
    && observedItem.changeKinds.includes("version")
    && expectedItem.changeKinds.includes("version");
}

function explainSide(expectedItems, observedItems, link, beforeDoc, afterDoc, shapes) {
  const unexplained = [];
  const used = new Set();
  expectedItems.forEach((item, index) => {
    const exact = observedItems.findIndex((candidate, candidateIndex) => !used.has(candidateIndex) && sameChanged(candidate, item));
    if (exact >= 0) {
      used.add(exact);
      return;
    }
    if (link.matched && link.linkIds.includes(item.id)) {
      const target = linkTarget(beforeDoc, afterDoc, item.id);
      if (shapes.targetSwitch) return;
      if (shapes.issue128 && target && item.before && item.after) {
        const paired = observedItems.findIndex((candidate, candidateIndex) => !used.has(candidateIndex) && candidate.before && candidate.id === target && versionsMatch(candidate, item));
        if (paired >= 0) {
          used.add(paired);
          return;
        }
      }
    }
    unexplained.push({ path: "expected", index, id: item.id });
  });
  observedItems.forEach((item, index) => {
    if (!used.has(index)) unexplained.push({ path: "observed", index, id: item.id });
  });
  return unexplained;
}

export function classifyBehavior({ expected, artifact, beforeDoc, afterDoc }) {
  const observed = projectionFromArtifact(artifact);
  const wanted = projectionFromExpected(expected);
  const link = linkProjection(beforeDoc, afterDoc, observed);
  const missing = missingIntegrity(observed);
  const shapes = {
    issue128: issue128Behavior(beforeDoc, afterDoc, observed, link),
    targetSwitch: targetSwitchBehavior(beforeDoc, afterDoc, observed, link),
  };
  const equal = JSON.stringify(wanted) === JSON.stringify(observed);
  const unexplained = [];
  if (!equal) {
    for (const side of ["changed", "added", "removed"]) {
      const normalizer = side === "changed" ? normChanged : normPin;
      const itemDiffs = explainSide(
        wanted[side].map(normalizer),
        observed[side].map(normalizer),
        link,
        beforeDoc,
        afterDoc,
        shapes,
      );
      for (const diff of itemDiffs) unexplained.push({ side, ...diff });
    }
    const itemsClean = unexplained.length === 0;
    if (wanted.status !== observed.status) {
      const partialExplains = missing.matched && observed.status === "partial";
      const omissionExplains = shapes.targetSwitch && observed.counts.changed === 0 && (observed.status === "informational" || observed.status === "partial");
      if (!partialExplains && !omissionExplains) unexplained.push({ side: "status", expected: wanted.status, observed: observed.status });
    }
    for (const key of COUNT_KEYS) {
      if (wanted.counts[key] === observed.counts[key]) continue;
      if (key === "missingIntegrity" && missing.matched) continue;
      if (itemsClean && link.matched && key !== "missingIntegrity") continue;
      unexplained.push({ side: "counts", key, expected: wanted.counts[key], observed: observed.counts[key] });
    }
  }
  let outcome = "candidate_report";
  let reason = "unexplained_difference";
  if (equal) {
    outcome = "stopping_point";
    reason = "expected_matches_observed";
  } else if (unexplained.length === 0 && (link.matched || missing.matched)) {
    outcome = "stopping_point";
    reason = "documented_behavior";
  }
  const matchedFacts = [missing.matched ? missing.id : null, link.matched ? link.id : null].filter(Boolean);
  return {
    outcome,
    reason,
    equal,
    unexplained,
    documentedLimits: {
      status: "applied",
      advisory: true,
      award: false,
      rejection: false,
      matchedFacts,
      missingIntegrityPartial: missing,
      installedLinkProjection: link,
      issue128Behavior: shapes.issue128,
      targetSwitchBehavior: shapes.targetSwitch,
      knownIssue: shapes.issue128 ? { number: 128, url: PINS.engine.issue128Url, matchedBy: "behavior" } : null,
      featureMapUrl: missing.matched ? PINS.engine.featureMapUrl : null,
      observationUrl: shapes.targetSwitch ? PINS.engine.issue128ObservationUrl : null,
    },
  };
}

function expectedShape(expected) {
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) return "expected";
  if (typeof expected.status !== "string" || !expected.counts || typeof expected.counts !== "object") return "expected";
  for (const key of COUNT_KEYS) if (!Number.isInteger(expected.counts[key]) || expected.counts[key] < 0) return "expected.counts";
  for (const side of ["added", "removed", "changed"]) if (!Array.isArray(expected[side])) return `expected.${side}`;
  return null;
}

function offerView(offer, source) {
  return {
    source: source.kind,
    url: source.url ?? null,
    sha256: source.sha256,
    id: offer.id ?? null,
    state: offer.state ?? null,
    acceptsSubmissions: offer.acceptsSubmissions ?? null,
    reward: offer.reward ?? null,
    boundary: offer.boundary ?? null,
    inScope: offer.inScope ?? null,
    outOfScope: offer.outOfScope ?? null,
    preflightAdvisory: offer.preflight?.advisory ?? null,
  };
}

function inputRecord(filePath, loaded) {
  return { path: path.resolve(filePath), sha256: loaded.sha256, bytes: loaded.bytes };
}

async function loadOffer(args) {
  if (typeof args.offer === "string") {
    const loaded = readJsonFile(args.offer);
    if (!loaded.ok) return { ok: false, missing: [`offer:${loaded.reason}`] };
    return { ok: true, offer: loaded.value, source: { kind: "caller_file", sha256: loaded.sha256, url: null } };
  }
  if (args.offer === true) return { ok: false, missing: ["offer"] };
  const url = PINS.offerUrl;
  let response;
  try {
    response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000) });
  } catch (err) {
    return { ok: false, fetchError: String(err?.message || err) };
  }
  if (response.status !== 200) return { ok: false, fetchError: `status ${response.status}` };
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 1_000_000) return { ok: false, fetchError: "body too large" };
  try {
    const offer = JSON.parse(bytes.toString("utf8"));
    return { ok: true, offer, source: { kind: "fetched", sha256: sha256(bytes), url } };
  } catch {
    return { ok: false, fetchError: "offer json" };
  }
}

function findSymlink(dir) {
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name);
    const stat = lstatSync(abs);
    if (stat.isSymbolicLink()) return abs;
    if (stat.isDirectory()) {
      const nested = findSymlink(abs);
      if (nested) return nested;
    }
  }
  return null;
}

function safeMembers(archivePath) {
  const listed = spawnSync("tar", ["-tzf", archivePath], { encoding: "utf8" });
  if (listed.status !== 0) return { ok: false, error: listed.stderr };
  const names = listed.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  for (const name of names) {
    if (name.startsWith("/") || name.split("/").includes("..")) return { ok: false, error: `refused member ${name}` };
  }
  return { ok: true, names };
}

async function downloadTo(url, dest) {
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20000) });
  if (response.status !== 200) throw new Error(`GET ${url} status ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 1_000_000) throw new Error(`GET ${url} body too large`);
  writeFileSync(dest, bytes);
  return bytes;
}

function identityReport(identity, offer, source) {
  return {
    ok: false,
    schema: "neomorphic.lockfile-defect-report.v1",
    phase: "report_preparation",
    code: "refresh_or_unknown",
    outcome: "identity_unknown",
    submitted: false,
    paidClaim: false,
    rewardPromised: false,
    ownerFixtureUsed: false,
    customerRevenueClaim: false,
    offer: offerView(offer, source),
    identity,
    documentedLimits: { status: "unknown", advisory: true, award: false, rejection: false, knownIssue: null },
    execution: null,
    nextAction: "The fetched offer, kit, and pinned identities do not agree. Refresh them before treating an older description as current. This command did not run a mismatched kit and did not submit a claim.",
  };
}

function markdown(report) {
  const lines = [
    "# Lockfile defect report",
    "",
    `Outcome: ${report.outcome}.`,
    `Phase: ${report.phase}. This is not a submission, an award, or a payment.`,
    "",
    `Offer: ${report.offer?.id ?? "unknown"} from ${report.offer?.source ?? "unknown"}.`,
    `Reward preserved from that offer: ${JSON.stringify(report.offer?.reward ?? null)}.`,
    `Terms status: ${report.identity?.termsStatus ?? "unknown"}. Identity status: ${report.identity?.status ?? "unknown"}.`,
    "",
  ];
  if (report.execution) {
    lines.push(
      `Command exit: ${report.execution.exit}.`,
      `Artifact sha256: ${report.execution.artifact?.sha256 ?? "none"}.`,
      `Observed status: ${report.execution.artifact?.status ?? "none"}.`,
      `Documented command: ${PINS.kit.command}`,
      "",
    );
  } else {
    lines.push("The engine was not run.", "");
  }
  lines.push(report.nextAction ?? "", "");
  return `${lines.join("\n")}\n`;
}

function writeReport(dir, report) {
  mkdirSync(dir);
  writeFileSync(path.join(dir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(dir, "report.md"), markdown(report));
}

function nextActionFor(classification) {
  if (classification.reason === "expected_matches_observed") {
    return "The engine projection matches the caller's expected pin-delta. No contrary defect is shown. This stopping point is not an acceptance or a reward.";
  }
  if (classification.reason === "documented_behavior") {
    const issue = classification.documentedLimits.knownIssue
      ? ` The artifact matches issue ${classification.documentedLimits.knownIssue.number} by behavior.`
      : "";
    return `The difference matches a documented limit of this pinned engine.${issue} No new eligible defect is shown. Offer notes stay advisory: this is not a rejection, a duplicate ruling, or a submission.`;
  }
  return "An unexplained difference remains. The report keeps the command, exit, and artifact for the caller. This command does not file an issue and does not promise a reward.";
}

async function acquire(args) {
  if (typeof args.work !== "string") fail("missing_input", { missing: ["work"], nextAction: "Pass a new --work directory." }, 2);
  if (regularFile(args.work).reason !== "missing" && lstatSync(args.work, { throwIfNoEntry: false })) {
    fail("work_exists", { nextAction: "Choose a directory that does not exist yet." }, 2);
  }
  const loaded = await loadOffer(args);
  if (!loaded.ok) {
    fail(loaded.missing ? "missing_input" : "offer_unavailable", {
      missing: loaded.missing,
      error: loaded.fetchError ?? null,
      nextAction: "The current offer was not available. Do not substitute the pin file as the offer.",
    }, loaded.missing ? 2 : 3);
  }
  const identity = compareIdentity({ offer: loaded.offer, kitSource: null, archive: null });
  mkdirSync(args.work);
  writeFileSync(path.join(args.work, "offer.json"), `${JSON.stringify(loaded.offer)}\n`);
  if (identity.status !== "agreed" || identity.termsStatus !== "agreed") {
    const body = {
      ...identityReport(identity, loaded.offer, loaded.source),
      phase: "install",
      nextAction: "Install stopped because the offer does not match the pinned kit identity or the original terms. Nothing was downloaded and the owner fixture was not run.",
    };
    writeFileSync(path.join(args.work, "install.json"), `${JSON.stringify(body, null, 2)}\n`);
    emit(body, 3);
  }
  const archivePath = path.join(args.work, PINS.kit.archive);
  const sumsPath = path.join(args.work, "SHA256SUMS");
  try {
    await downloadTo(PINS.kit.archiveUrl, archivePath);
    await downloadTo(PINS.kit.sha256sumsUrl, sumsPath);
  } catch (err) {
    const body = {
      ok: false,
      phase: "install",
      code: "fetch_failed",
      submitted: false,
      paidClaim: false,
      error: String(err?.message || err),
      nextAction: "The pinned kit URL did not return the archive. Do not fetch a different URL from an unexpected offer field.",
    };
    writeFileSync(path.join(args.work, "install.json"), `${JSON.stringify(body, null, 2)}\n`);
    emit(body, 3);
  }
  const archive = archiveIdentity(archivePath);
  const sums = readFileSync(sumsPath, "utf8");
  const members = safeMembers(archivePath);
  const sumsOk = sums.split("\n").some((line) => line === `${PINS.kit.sha256}  ${PINS.kit.archive}`);
  if (!archive.ok || archive.sha256 !== PINS.kit.sha256 || archive.bytes !== PINS.kit.bytes || !sumsOk || !members.ok || members.names.length !== PINS.kit.members) {
    fail("kit_mismatch", {
      phase: "install",
      archive,
      members: members.ok ? members.names.length : members.error,
      nextAction: "The downloaded bytes do not match the pin. They were not extracted.",
    }, 3);
  }
  const extracted = spawnSync("tar", ["-xzf", archivePath, "-C", args.work], { encoding: "utf8" });
  if (extracted.status !== 0) fail("extract_failed", { error: extracted.stderr }, 1);
  const kitDir = path.join(args.work, PINS.kit.directory);
  const linked = findSymlink(kitDir);
  if (linked) fail("kit_mismatch", { error: `symlink ${linked}`, nextAction: "The archive was not accepted." }, 3);
  const kitSource = readKitSource(kitDir);
  const extractedIdentity = compareIdentity({ offer: loaded.offer, kitSource, archive });
  const body = {
    ok: extractedIdentity.status === "agreed",
    schema: "neomorphic.lockfile-defect-report.v1",
    phase: "install",
    submitted: false,
    paidClaim: false,
    rewardPromised: false,
    reproduceRan: false,
    ownerFixtureUsed: false,
    customerRevenueClaim: false,
    offer: offerView(loaded.offer, loaded.source),
    identity: extractedIdentity,
    archive: { sha256: archive.sha256, bytes: archive.bytes, members: members.names.length },
    kitDir,
    nextAction: extractedIdentity.status === "agreed"
      ? "Run report with your own before.json, after.json, and expected pin-delta. Do not use the kit owner fixture as that pair."
      : "The extracted kit source does not match the offer. Do not treat it as the current engine.",
  };
  writeFileSync(path.join(args.work, "install.json"), `${JSON.stringify(body, null, 2)}\n`);
  emit(body, body.ok ? 0 : 3);
}

function engineRefusal(stdout) {
  if (!stdout || stdout.ok !== false) return null;
  return typeof stdout.code === "string" ? stdout.code : null;
}

async function report(args) {
  for (const flag of REFUSAL_FLAGS) {
    if (args[flag]) fail("refused_flag", { flag, nextAction: "Submission, payment, and award stay outside this command." }, 2);
  }
  const required = ["kit", "archive", "before", "after", "expected", "out"];
  const missing = required.filter((key) => typeof args[key] !== "string");
  if (missing.length) {
    fail("missing_input", {
      missing,
      nextAction: "Supply the caller lockfile pair, the explicit expected pin-delta, the verified kit, and a new output directory. The owner fixture is not a substitute.",
    }, 2);
  }
  if (lstatSync(args.out, { throwIfNoEntry: false })) fail("out_exists", { nextAction: "Choose an output directory that does not exist." }, 2);
  const files = {};
  for (const key of ["before", "after", "expected", "archive"]) {
    const info = regularFile(args[key]);
    if (!info.ok) {
      fail("missing_input", { missing: [`${key}:${info.reason}`], nextAction: "A missing caller file stays missing." }, 2);
    }
    files[key] = info;
  }
  const kitStat = lstatSync(args.kit, { throwIfNoEntry: false });
  if (!kitStat || !kitStat.isDirectory() || kitStat.isSymbolicLink()) fail("missing_input", { missing: ["kit"] }, 2);
  const expected = readJsonFile(args.expected);
  if (!expected.ok) fail("missing_input", { missing: [`expected:${expected.reason}`] }, 2);
  const shape = expectedShape(expected.value);
  if (shape) fail("invalid_expected", { missing: [shape], nextAction: "The expected file needs status, counts, added, removed, and changed." }, 2);
  const before = readJsonFile(args.before);
  const after = readJsonFile(args.after);
  if (!before.ok || !after.ok) {
    fail("missing_input", { missing: [before.ok ? null : "before", after.ok ? null : "after"].filter(Boolean) }, 2);
  }
  const loaded = await loadOffer(args);
  if (!loaded.ok) {
    fail(loaded.missing ? "missing_input" : "offer_unavailable", {
      missing: loaded.missing,
      error: loaded.fetchError ?? null,
      nextAction: "A missing current offer stays missing. The pin file is not a substitute offer.",
    }, loaded.missing ? 2 : 3);
  }
  let kitSource = null;
  try {
    kitSource = readKitSource(args.kit);
  } catch {
    kitSource = null;
  }
  const archive = archiveIdentity(args.archive);
  const identity = compareIdentity({
    offer: loaded.offer,
    kitSource,
    archive: archive.ok ? archive : null,
  });
  if (!identity.offerKitRunnable) {
    const body = {
      ...identityReport(identity, loaded.offer, loaded.source),
      inputs: {
        before: inputRecord(args.before, before),
        after: inputRecord(args.after, after),
        expected: inputRecord(args.expected, expected),
        labeledQa: expected.value.qa === true,
        ownerFixtureUsed: false,
      },
      nextAction: "The offer and the kit on disk disagree, or the archive hash does not match the offer. The engine was not run. Refresh the disagreeing identity instead of reusing an older description.",
    };
    writeReport(args.out, body);
    emit(body, 3);
  }
  const bin = path.join(args.kit, "engine", "bin", "lockfile-delta.mjs");
  if (!regularFile(bin).ok) fail("kit_invalid", { missing: ["engine/bin/lockfile-delta.mjs"] }, 3);
  const resultDir = path.join(args.out, "result");
  const argv = [process.execPath, bin, "--before", path.resolve(args.before), "--after", path.resolve(args.after), "--out-dir", resultDir];
  mkdirSync(args.out);
  const run = spawnSync(argv[0], argv.slice(1), { encoding: "utf8", timeout: 20000 });
  let stdout = null;
  try {
    stdout = JSON.parse(run.stdout);
  } catch {
    stdout = null;
  }
  const artifactPath = path.join(resultDir, "pin-delta.json");
  const markdownPath = path.join(resultDir, "pin-delta.md");
  const artifactInfo = regularFile(artifactPath);
  let artifact = null;
  let artifactSha = null;
  if (artifactInfo.ok) {
    const bytes = readFileSync(artifactPath);
    artifactSha = sha256(bytes);
    try {
      artifact = JSON.parse(bytes.toString("utf8"));
    } catch {
      artifact = null;
    }
  }
  const refusal = engineRefusal(stdout);
  const digestAgrees = Boolean(artifactSha && stdout?.digest === artifactSha);
  const base = {
    schema: "neomorphic.lockfile-defect-report.v1",
    phase: "report_preparation",
    submitted: false,
    paidClaim: false,
    rewardPromised: false,
    ownerFixtureUsed: false,
    customerRevenueClaim: false,
    offer: offerView(loaded.offer, loaded.source),
    identity,
    inputs: {
      before: inputRecord(args.before, before),
      after: inputRecord(args.after, after),
      expected: inputRecord(args.expected, expected),
      labeledQa: expected.value.qa === true,
      ownerFixtureUsed: false,
    },
    execution: {
      documentedCommand: PINS.kit.command,
      argv,
      exit: run.status,
      signal: run.signal,
      stdout,
      stderr: run.stderr,
      artifact: artifact ? {
        json: artifactPath,
        markdown: markdownPath,
        sha256: artifactSha,
        digestAgrees,
        status: artifact.status,
        counts: artifact.counts,
        changed: (artifact.changed ?? []).map(normChanged),
        added: (artifact.added ?? []).map(normPin),
        removed: (artifact.removed ?? []).map(normPin),
        gaps: artifact.gaps ?? [],
        purchaseAuthority: artifact.purchaseAuthority,
        provenance: artifact.provenance,
        lockfileVersion: artifact.lockfileVersion,
      } : null,
    },
  };
  if (refusal && KNOWN_ENGINE_REFUSALS.has(refusal) && identity.documentedLimitsCurrent) {
    const body = {
      ...base,
      ok: identity.termsStatus === "agreed",
      outcome: identity.termsStatus === "agreed" ? "stopping_point" : "identity_unknown",
      reason: "engine_refused",
      comparison: null,
      documentedLimits: {
        status: "applied",
        advisory: true,
        award: false,
        rejection: false,
        knownIssue: null,
        engineRefusal: refusal,
      },
      nextAction: `The engine refused the pair with ${refusal}. The fetched offer lists known supported refusals as out of scope. That note is advisory and this command did not reject or submit a claim.`,
    };
    writeFileSync(path.join(args.out, "report.json"), `${JSON.stringify(body, null, 2)}\n`);
    writeFileSync(path.join(args.out, "report.md"), markdown(body));
    emit(body, identity.termsStatus === "agreed" ? 0 : 3);
  }
  const rawEqual = artifact
    ? JSON.stringify(projectionFromExpected(expected.value)) === JSON.stringify(projectionFromArtifact(artifact))
    : null;
  if (!identity.documentedLimitsCurrent) {
    const body = {
      ...base,
      ok: false,
      outcome: "identity_unknown",
      reason: "refresh_or_unknown",
      comparison: { equal: rawEqual, unexplained: null },
      documentedLimits: { status: "unknown", advisory: true, award: false, rejection: false, knownIssue: null },
      nextAction: "The offer and kit agree with each other but not with this skill's pinned identity. The engine result is recorded and documented limits were not applied. Do not treat the pinned description as current.",
    };
    writeFileSync(path.join(args.out, "report.json"), `${JSON.stringify(body, null, 2)}\n`);
    writeFileSync(path.join(args.out, "report.md"), markdown(body));
    emit(body, 3);
  }
  if (run.status !== 0 || !artifact || !digestAgrees || artifact.purchaseAuthority !== false) {
    const body = {
      ...base,
      ok: false,
      outcome: "stopping_point",
      reason: "artifact_unusable",
      comparison: null,
      documentedLimits: { status: "unknown", advisory: true, award: false, rejection: false, knownIssue: null },
      nextAction: "The engine did not produce a usable pin-delta artifact. Do not invent the observed projection.",
    };
    writeFileSync(path.join(args.out, "report.json"), `${JSON.stringify(body, null, 2)}\n`);
    writeFileSync(path.join(args.out, "report.md"), markdown(body));
    emit(body, run.status === 0 ? 1 : run.status || 1);
  }
  const classification = classifyBehavior({
    expected: expected.value,
    artifact,
    beforeDoc: before.value,
    afterDoc: after.value,
  });
  const body = {
    ...base,
    ok: identity.termsStatus === "agreed",
    outcome: identity.termsStatus === "agreed" ? classification.outcome : "identity_unknown",
    reason: identity.termsStatus === "agreed" ? classification.reason : "refresh_or_unknown",
    comparison: { equal: classification.equal, unexplained: classification.unexplained },
    documentedLimits: classification.documentedLimits,
    behavior: identity.termsStatus === "agreed" ? undefined : { outcome: classification.outcome, reason: classification.reason },
    nextAction: nextActionFor(classification),
  };
  if (identity.termsStatus !== "agreed") {
    body.nextAction = `Fetched reward terms differ from the original one-award terms. ${body.nextAction}`;
  }
  if (expected.value.qa === true) {
    body.nextAction = `${body.nextAction} This pair is labeled QA and is not independent use or customer revenue.`;
  }
  writeFileSync(path.join(args.out, "report.json"), `${JSON.stringify(body, null, 2)}\n`);
  writeFileSync(path.join(args.out, "report.md"), markdown(body));
  emit(body, identity.termsStatus === "agreed" ? 0 : 3);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length === 0) {
    process.stdout.write(usage());
    process.exit(args.help ? 0 : 2);
  }
  if (Number(process.versions.node.split(".")[0]) < 22) fail("runtime", { error: "Node.js 22 or newer is required" }, 2);
  const command = args._[0];
  if (command === "acquire") await acquire(args);
  else if (command === "report") await report(args);
  else fail("unknown_command", { command, nextAction: "Use acquire or report." }, 2);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((err) => {
    fail("internal", { error: String(err?.message || err) }, 1);
  });
}
